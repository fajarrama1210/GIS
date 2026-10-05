<?php
// Backend proxy and short-lived cache for official BPS and BIG geographic data.

$GLOBALS['geography_stale_data'] = false;
$GLOBALS['geography_stale_sources'] = [];

function geographyError(string $message, int $status, ?Throwable $cause = null): never {
    if ($cause) {
        error_log('Geography API error: ' . $cause->getMessage());
    }
    jsonResponse(['success' => false, 'message' => $message, 'data' => null], $status);
}

function staleExternalJson(?array $cachedRow, string $cacheKey, string $reason): ?array {
    if (!$cachedRow) {
        return null;
    }
    $decoded = json_decode($cachedRow['payload'], true);
    if (!is_array($decoded)) {
        return null;
    }
    if (strpos($cacheKey, 'bps:') === 0 && ($decoded['status'] ?? '') !== 'OK') {
        return null;
    }

    $source = strpos($cacheKey, 'bps:') === 0 ? 'BPS' : 'BIG';
    $GLOBALS['geography_stale_data'] = true;
    $GLOBALS['geography_stale_sources'][$source] = $reason;
    return $decoded;
}

function bpsApiKey(): string {
    $key = getenv('BPS_API_KEY');
    if (is_string($key) && trim($key) !== '') {
        return trim($key);
    }

    $envPath = dirname(__DIR__) . '/.env';
    if (is_file($envPath) && is_readable($envPath)) {
        foreach (file($envPath, FILE_IGNORE_NEW_LINES) ?: [] as $line) {
            if (!preg_match('/^\s*BPS_API_KEY\s*=\s*(.*?)\s*$/', $line, $matches)) {
                continue;
            }
            $key = trim($matches[1]);
            if (strlen($key) >= 2 && (($key[0] === '"' && substr($key, -1) === '"') || ($key[0] === "'" && substr($key, -1) === "'"))) {
                $key = substr($key, 1, -1);
            }
            if ($key !== '') {
                return $key;
            }
        }
    }

    geographyError('API key BPS belum dikonfigurasi. Atur BPS_API_KEY pada backend/.env.', 503);
}

function externalJson(string $cacheKey, string $url, int $ttlSeconds, bool $allowProviderFallback = false): array {
    global $conn;

    $source = strpos($cacheKey, 'bps:') === 0 ? 'BPS' : 'BIG';
    $keyHash = hash('sha256', $cacheKey);
    $cached = $conn->prepare('SELECT payload, expires_at > NOW() AS is_fresh FROM external_data_cache WHERE cache_key = ? LIMIT 1');
    $cached->bind_param('s', $keyHash);
    $cached->execute();
    $cachedRow = $cached->get_result()->fetch_assoc();
    if ($cachedRow && (int) $cachedRow['is_fresh'] === 1) {
        $decoded = json_decode($cachedRow['payload'], true);
        $validBpsResponse = strpos($cacheKey, 'bps:') !== 0
            || (is_array($decoded) && ($decoded['status'] ?? '') === 'OK');
        if (is_array($decoded) && $validBpsResponse) {
            return $decoded;
        }
    }

    $body = false;
    $httpStatus = 0;
    for ($attempt = 0; $attempt < 3; $attempt++) {
        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'timeout' => 30,
                'ignore_errors' => true,
                'header' => "Accept: application/json\r\nUser-Agent: Jember-GIS/1.0\r\n",
            ],
            'ssl' => [
                'verify_peer' => true,
                'verify_peer_name' => true,
            ],
        ]);
        $body = @file_get_contents($url, false, $context);
        $responseHeaders = $http_response_header ?? [];
        $httpStatus = 0;
        if (isset($responseHeaders[0]) && preg_match('/\s(\d{3})\s/', $responseHeaders[0], $statusMatch)) {
            $httpStatus = (int) $statusMatch[1];
        }
        if ($body !== false && $httpStatus >= 200 && $httpStatus < 300) {
            break;
        }
        if ($attempt < 2) {
            usleep(250000 * ($attempt + 1));
        }
    }

    if ($body === false || $httpStatus < 200 || $httpStatus >= 300) {
        error_log('External geography provider request failed with HTTP ' . $httpStatus . '.');
        $stale = staleExternalJson($cachedRow, $cacheKey, 'Cache sebelumnya digunakan karena penyedia data tidak merespons.');
        if ($stale !== null) {
            return $stale;
        }
        if ($allowProviderFallback) {
            return ['status' => 'LOCAL_FALLBACK'];
        }
        geographyError('Penyedia data wilayah/statistik tidak merespons setelah dicoba ulang.', 502);
    }
    if (preg_match('/^\s*<!doctype\s+html/i', $body)) {
        error_log('External geography provider returned an HTML access-block page instead of JSON.');
        $stale = staleExternalJson($cachedRow, $cacheKey, 'Cache sebelumnya digunakan sementara karena penyedia membatasi permintaan.');
        if ($stale !== null) {
            return $stale;
        }
        if ($allowProviderFallback) {
            return ['status' => 'LOCAL_FALLBACK'];
        }
        geographyError("Permintaan ditolak oleh layanan {$source} (halaman pembatasan akses). Ini berasal dari penyedia data; coba lagi nanti.", 502);
    }

    try {
        $decoded = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $error) {
        $stale = staleExternalJson($cachedRow, $cacheKey, 'Cache sebelumnya digunakan karena respons penyedia tidak valid.');
        if ($stale !== null) {
            return $stale;
        }
        geographyError('Sumber data wilayah/statistik mengirim respons yang tidak valid.', 502, $error);
    }
    if (!is_array($decoded)) {
        $stale = staleExternalJson($cachedRow, $cacheKey, 'Cache sebelumnya digunakan karena respons penyedia tidak valid.');
        if ($stale !== null) {
            return $stale;
        }
        geographyError('Sumber data wilayah/statistik mengirim respons yang tidak valid.', 502);
    }
    if (strpos($cacheKey, 'bps:') === 0 && isset($decoded['status']) && $decoded['status'] !== 'OK') {
        $stale = staleExternalJson($cachedRow, $cacheKey, 'Cache sebelumnya digunakan sementara karena BPS membatasi atau menolak permintaan.');
        return $stale ?? $decoded;
    }

    $payload = json_encode($decoded, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($payload === false) {
        geographyError('Respons data wilayah/statistik gagal diproses.', 502);
    }
    $expiresAt = date('Y-m-d H:i:s', time() + $ttlSeconds);
    $save = $conn->prepare(
        'INSERT INTO external_data_cache (cache_key, payload, expires_at) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE payload = VALUES(payload), expires_at = VALUES(expires_at)'
    );
    $save->bind_param('sss', $keyHash, $payload, $expiresAt);
    $save->execute();

    return $decoded;
}

function bpsRequest(
    string $path,
    array $parameters,
    string $cacheKey,
    int $ttlSeconds = 86400,
    bool $allowProviderFallback = false
): array {
    $key = bpsApiKey();
    $parameters['key'] = $key;
    $url = 'https://webapi.bps.go.id/v1/api/interoperabilitas/datasource/simdasi/id/'
        . $path . '/?' . http_build_query($parameters, '', '&', PHP_QUERY_RFC3986);
    $response = externalJson('bps:' . $cacheKey, $url, $ttlSeconds, $allowProviderFallback);

    if (($response['status'] ?? '') !== 'OK') {
        error_log('BPS API returned a non-OK response.');
        if ($allowProviderFallback) {
            return ['status' => 'LOCAL_FALLBACK'];
        }
        geographyError('BPS tidak dapat menyediakan data untuk wilayah yang dipilih.', 502);
    }

    return $response;
}

function bpsRegionList(string $level, ?string $parent = null): array {
    $routes = ['province' => '26', 'regency' => '27', 'district' => '28'];
    if (!isset($routes[$level])) {
        geographyError('Tingkat wilayah tidak dikenal.', 400);
    }
    if ($level !== 'province' && (!$parent || !preg_match('/^\d{7}$/', $parent))) {
        geographyError('Kode wilayah induk tidak valid.', 400);
    }

    $regions = [];
    $page = 1;
    $pageCount = 1;
    do {
        $parameters = ['page' => $page];
        if ($parent !== null) {
            $parameters['parent'] = $parent;
        }
        $response = bpsRequest(
            $routes[$level],
            $parameters,
            'regions:' . $level . ':' . ($parent ?? 'all') . ':' . $page,
            604800
        );
        $pages = $response['data'][0] ?? null;
        $content = $response['data'][1]['data'] ?? null;
        if (!is_array($pages) || !is_array($content)) {
            geographyError('Format daftar wilayah dari BPS tidak sesuai.', 502);
        }
        $pageCount = max(1, (int) ($pages['pages'] ?? 1));
        foreach ($content as $row) {
            if (!isset($row['kode'], $row['nama'])
                || !preg_match('/^\d{7}$/', (string) $row['kode'])
                || (string) $row['kode'] === '0000000') {
                continue;
            }
            $regions[] = [
                'code' => (string) $row['kode'],
                'name' => (string) $row['nama'],
                'type' => (string) ($row['satuan_lingkungan'] ?? ''),
            ];
        }
        $page++;
    } while ($page <= $pageCount);

    return $regions;
}

function requireBpsRegion(array $regions, string $code): array {
    foreach ($regions as $region) {
        if ($region['code'] === $code) {
            return $region;
        }
    }
    geographyError('Wilayah tidak ditemukan pada daftar kode resmi BPS.', 404);
}

function normalizeRegionName(string $name): string {
    $name = preg_replace('/^(kabupaten|kota)\s+/iu', '', trim($name));
    return strtolower(preg_replace('/[^[:alnum:]]/u', '', $name));
}

function parseBpsNumber($value): ?float {
    if (!is_string($value) && !is_numeric($value)) {
        return null;
    }
    $value = trim((string) $value);
    if ($value === '' || $value === '...' || $value === '-' || $value === '–') {
        return null;
    }
    $value = preg_replace('/\s+/u', '', $value);
    if (strpos($value, ',') !== false) {
        $value = str_replace('.', '', $value);
        $value = str_replace(',', '.', $value);
    } else {
        $value = str_replace('.', '', $value);
    }
    return is_numeric($value) ? (float) $value : null;
}

function bpsPopulationData(string $regionCode, string $rowLevel, bool $allowProviderFallback = false): array {
    $tablesResponse = bpsRequest('23', ['wilayah' => $regionCode, 'page' => 1], 'tables:' . $regionCode, 43200, $allowProviderFallback);
    if (($tablesResponse['status'] ?? '') === 'LOCAL_FALLBACK') {
        return ['year' => null, 'title' => 'Statistik lokal administrator (BPS tidak tersedia)', 'rows' => []];
    }
    $pagination = $tablesResponse['data'][0] ?? null;
    $tableMetadata = $tablesResponse['data'][1] ?? null;
    if (!is_array($pagination) || !is_array($tableMetadata)) {
        geographyError('Format daftar tabel BPS tidak sesuai.', 502);
    }

    $tables = $tableMetadata['data'] ?? [];
    $pages = max(1, (int) ($pagination['pages'] ?? 1));
    for ($page = 2; $page <= $pages; $page++) {
        $next = bpsRequest('23', ['wilayah' => $regionCode, 'page' => $page], 'tables:' . $regionCode . ':' . $page, 43200, $allowProviderFallback);
        if (($next['status'] ?? '') === 'LOCAL_FALLBACK') {
            return ['year' => null, 'title' => 'Statistik lokal administrator (BPS tidak tersedia)', 'rows' => []];
        }
        foreach (($next['data'][1]['data'] ?? []) as $table) {
            $tables[] = $table;
        }
    }

    $pattern = $rowLevel === 'regency'
        ? '/penduduk.*menurut.*kabupaten\\/kota/i'
        : '/penduduk.*menurut.*kecamatan/i';
    $matchingTables = array_values(array_filter($tables, static function ($table) use ($pattern) {
        return isset($table['judul'], $table['id_tabel'])
            && preg_match($pattern, strip_tags((string) $table['judul']));
    }));
    if (!$matchingTables) {
        return ['year' => null, 'title' => 'Statistik lokal administrator', 'rows' => []];
    }

    usort($matchingTables, static function ($left, $right) {
        $leftYear = max(array_map('intval', $left['ketersediaan_tahun'] ?? [0]));
        $rightYear = max(array_map('intval', $right['ketersediaan_tahun'] ?? [0]));
        return $rightYear <=> $leftYear;
    });

    foreach ($matchingTables as $table) {
        $years = array_values(array_filter(
            array_map('intval', $table['ketersediaan_tahun'] ?? []),
            static fn($year) => $year > 0
        ));
        rsort($years, SORT_NUMERIC);
        foreach ($years as $year) {
            $response = bpsRequest(
                '25',
                [
                    'wilayah' => $regionCode,
                    'tahun' => $year,
                    'id_tabel' => $table['id_tabel'],
                ],
                'data:' . $regionCode . ':' . $table['id_tabel'] . ':' . $year,
                604800,
                $allowProviderFallback
            );
            if (($response['status'] ?? '') === 'LOCAL_FALLBACK') {
                return ['year' => null, 'title' => 'Statistik lokal administrator (BPS tidak tersedia)', 'rows' => []];
            }
            $data = $response['data'][1] ?? null;
            if (!is_array($data) || ($data['condition'] ?? '') !== 'OK') {
                continue;
            }

            $columnKeys = [];
            foreach (($data['kolom'] ?? []) as $key => $column) {
                $name = strtolower((string) ($column['nama_variabel'] ?? ''));
                if (preg_match('/jumlah penduduk/', $name)) {
                    $columnKeys['population'] = (string) $key;
                } elseif (preg_match('/laju pertumbuhan penduduk/', $name)) {
                    $columnKeys['growth'] = (string) $key;
                } elseif (preg_match('/distribusi persentase penduduk|persentase penduduk/', $name)) {
                    $columnKeys['distribution'] = (string) $key;
                } elseif (preg_match('/kepadatan penduduk/', $name)) {
                    $columnKeys['density'] = (string) $key;
                } elseif (preg_match('/rasio jenis kelamin/', $name)) {
                    $columnKeys['sex_ratio'] = (string) $key;
                }
            }
            if (!isset($columnKeys['population'])) {
                continue;
            }

            $rows = [];
            $hasPopulationValue = false;
            foreach (($data['data'] ?? []) as $record) {
                $variables = $record['variables'] ?? [];
                $row = [
                    'id' => (string) ($record['kode_wilayah'] ?? ''),
                    'kode_wilayah' => (string) ($record['kode_wilayah'] ?? ''),
                    'nama_wilayah' => (string) ($record['label'] ?? ''),
                    'nama_kecamatan' => (string) ($record['label'] ?? ''),
                    'jumlah_penduduk' => parseBpsNumber($variables[$columnKeys['population']]['value'] ?? null),
                    'laju_pertumbuhan' => isset($columnKeys['growth'])
                        ? parseBpsNumber($variables[$columnKeys['growth']]['value'] ?? null)
                        : null,
                    'distribusi_penduduk' => isset($columnKeys['distribution'])
                        ? parseBpsNumber($variables[$columnKeys['distribution']]['value'] ?? null)
                        : null,
                    'kepadatan_penduduk' => isset($columnKeys['density'])
                        ? parseBpsNumber($variables[$columnKeys['density']]['value'] ?? null)
                        : null,
                    'rasio_jenis_kelamin' => isset($columnKeys['sex_ratio'])
                        ? parseBpsNumber($variables[$columnKeys['sex_ratio']]['value'] ?? null)
                        : null,
                ];
                $hasPopulationValue = $hasPopulationValue || $row['jumlah_penduduk'] !== null;
                $rows[] = $row;
            }

            if ($hasPopulationValue) {
                return [
                    'year' => $year,
                    'title' => strip_tags((string) ($data['judul_tabel'] ?? $table['judul'])),
                    'rows' => $rows,
                ];
            }
        }
    }

    return ['year' => null, 'title' => 'Statistik lokal administrator', 'rows' => []];
}

function localDistrictRows(string $regencyCode): array {
    global $conn;

    $stmt = $conn->prepare(
        'SELECT kode_kecamatan, nama_kecamatan, jumlah_penduduk, laju_pertumbuhan,
                luas_wilayah, jumlah_faskes, jumlah_rentan, latitude, longitude,
                sumber_data, tahun_data
         FROM data_kecamatan WHERE kode_kabupaten = ? AND aktif_di_peta = 1 ORDER BY nama_kecamatan'
    );
    $stmt->bind_param('s', $regencyCode);
    $stmt->execute();
    $result = $stmt->get_result();
    $rows = [];
    while ($record = $result->fetch_assoc()) {
        $rows[] = [
            'id' => $record['kode_kecamatan'],
            'kode_wilayah' => $record['kode_kecamatan'],
            'nama_wilayah' => $record['nama_kecamatan'],
            'nama_kecamatan' => $record['nama_kecamatan'],
            'jumlah_penduduk' => (int) $record['jumlah_penduduk'],
            'laju_pertumbuhan' => (float) $record['laju_pertumbuhan'],
            'distribusi_penduduk' => null,
            'kepadatan_penduduk' => $record['luas_wilayah'] > 0
                ? (int) round($record['jumlah_penduduk'] / $record['luas_wilayah'])
                : null,
            'rasio_jenis_kelamin' => null,
            'luas_wilayah' => (float) $record['luas_wilayah'],
            'jumlah_faskes' => (int) $record['jumlah_faskes'],
            'latitude' => (float) $record['latitude'],
            'longitude' => (float) $record['longitude'],
            'sumber_data' => 'Data admin: ' . $record['sumber_data'],
            'tahun_data' => (int) $record['tahun_data'],
        ];
    }
    return $rows;
}

function mergeLocalDistrictRows(array $bpsRows, array $localRows, ?int $bpsYear): array {
    $indexes = [];
    $nameIndexes = [];
    foreach ($bpsRows as $index => &$row) {
        $row['sumber_data'] = 'BPS';
        $row['tahun_data'] = $bpsYear;
        $indexes[$row['kode_wilayah']] = $index;
        $nameIndexes[normalizeRegionName($row['nama_wilayah'])] = $index;
    }
    unset($row);

    foreach ($localRows as $local) {
        $code = $local['kode_wilayah'];
        $name = normalizeRegionName($local['nama_wilayah']);
        $index = $indexes[$code] ?? $nameIndexes[$name] ?? null;
        if ($index === null) {
            $bpsRows[] = $local;
            $index = array_key_last($bpsRows);
            $indexes[$code] = $index;
            $nameIndexes[$name] = $index;
        } elseif ($bpsRows[$index]['jumlah_penduduk'] === null) {
            $local['kode_wilayah'] = $bpsRows[$index]['kode_wilayah'];
            $local['id'] = $bpsRows[$index]['id'];
            $local['nama_wilayah'] = $bpsRows[$index]['nama_wilayah'];
            $local['nama_kecamatan'] = $bpsRows[$index]['nama_kecamatan'];
            $bpsRows[$index] = $local;
        }
    }
    return $bpsRows;
}

function appendLocalPointFeatures(array $geojson, array $rows): array {
    $matchedNames = [];
    foreach (($geojson['features'] ?? []) as $feature) {
        $properties = $feature['properties'] ?? [];
        $boundaryName = $properties['WADMKC'] ?? $properties['nama_wilayah'] ?? '';
        $matchedNames[normalizeRegionName((string) $boundaryName)] = true;
    }

    foreach ($rows as $row) {
        $name = normalizeRegionName($row['nama_wilayah']);
        if (isset($matchedNames[$name]) || !isset($row['latitude'], $row['longitude'])) {
            continue;
        }
        $geojson['features'][] = [
            'type' => 'Feature',
            'geometry' => [
                'type' => 'Point',
                'coordinates' => [$row['longitude'], $row['latitude']],
            ],
            'properties' => [
                'kode_wilayah' => $row['kode_wilayah'],
                'nama_wilayah' => $row['nama_wilayah'],
                'sumber_data' => $row['sumber_data'],
                'tahun_data' => $row['tahun_data'],
                'geometry_source' => 'Koordinat input admin',
            ],
        ];
        $matchedNames[$name] = true;
    }

    return $geojson;
}

function bigGeoJson(string $layer, array $whereParts, string $cacheKey): array {
    $layers = [
        'regency' => 'BATAS_KABKOTA_AR/MapServer/0',
        'district' => 'BATAS_KECAMATAN_AR/MapServer/0',
    ];
    if (!isset($layers[$layer])) {
        geographyError('Tingkat polygon wilayah tidak didukung.', 400);
    }

    $where = implode(' AND ', $whereParts);
    $url = 'https://geoservices.big.go.id/rbi/rest/services/BATASWILAYAH/'
        . $layers[$layer] . '/query?'
        . http_build_query([
            'where' => $where,
            'outFields' => 'WADMPR,WADMKK,WADMKC,KDPBPS,KDBBPS,KDCBPS',
            'returnGeometry' => 'true',
            'outSR' => '4326',
            'maxAllowableOffset' => $layer === 'regency' ? '0.01' : '0.002',
            'f' => 'geojson',
        ], '', '&', PHP_QUERY_RFC3986);
    $geojson = externalJson('big:' . $cacheKey, $url, 2592000);
    if (($geojson['type'] ?? '') !== 'FeatureCollection' || !is_array($geojson['features'] ?? null)) {
        geographyError('BIG tidak mengirim GeoJSON yang valid.', 502);
    }

    return $geojson;
}

function findRegionFeature(array $features, string $regionName, string $property): ?array {
    $target = normalizeRegionName($regionName);
    foreach ($features as $feature) {
        $properties = $feature['properties'] ?? [];
        if (normalizeRegionName((string) ($properties[$property] ?? '')) === $target) {
            return $feature;
        }
    }
    return null;
}
