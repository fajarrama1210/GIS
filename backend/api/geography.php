<?php
// Hierarki kode wilayah dan statistik BPS dipadukan dengan polygon resmi BIG.

require_once __DIR__ . '/../koneksi.php';
require_once __DIR__ . '/_middleware.php';
require_once __DIR__ . '/_geography.php';

// BPS/BIG external call bisa lambat saat cold cache; naikkan batas eksekusi PHP.
// Default XAMPP = 30 detik — terlalu pendek untuk multi-step BPS API call.
set_time_limit(150);

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$host  = $_SERVER['HTTP_HOST'] ?? '';
$allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://' . $host,
    'https://' . $host,
];
if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: {$origin}");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
    header('Access-Control-Allow-Methods: GET, OPTIONS');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    geographyError('Method tidak didukung.', 405);
}

/* ── Helper: kirim respons JSON dengan HTTP cache header ─────────────────── */
function sendCached(array $payload, int $ttlSeconds = 3600): never {
    $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $etag = '"' . hash('xxh3', $body) . '"';

    // ETag / conditional request support
    $ifNoneMatch = $_SERVER['HTTP_IF_NONE_MATCH'] ?? '';
    if ($ifNoneMatch === $etag) {
        http_response_code(304);
        exit;
    }

    header("Cache-Control: public, max-age={$ttlSeconds}, stale-while-revalidate=60");
    header("ETag: {$etag}");
    header('Vary: Accept-Encoding');

    // Gzip bila browser support
    $acceptEncoding = $_SERVER['HTTP_ACCEPT_ENCODING'] ?? '';
    if (str_contains($acceptEncoding, 'gzip') && strlen($body) > 1024) {
        $compressed = gzencode($body, 6);
        if ($compressed !== false) {
            header('Content-Encoding: gzip');
            echo $compressed;
            exit;
        }
    }

    echo $body;
    exit;
}

$action = $_GET['action'] ?? '';

/* ── provinces ───────────────────────────────────────────────────────────── */
if ($action === 'provinces') {
    // TTL 12 jam — daftar provinsi sangat jarang berubah
    sendCached(['success' => true, 'message' => 'OK', 'data' => bpsRegionList('province')], 43200);
}

/* ── regencies ───────────────────────────────────────────────────────────── */
if ($action === 'regencies') {
    $parent = $_GET['parent'] ?? '';
    if (!preg_match('/^\d{7}$/', $parent)) {
        geographyError('Kode provinsi tidak valid.', 400);
    }
    // Tidak perlu validasi ulang bpsRegionList('province') — kode sudah divalidasi format
    sendCached([
        'success' => true,
        'message' => 'OK',
        'data'    => bpsRegionList('regency', $parent),
    ], 43200);
}

/* ── districts ───────────────────────────────────────────────────────────── */
if ($action === 'districts') {
    $parent = $_GET['parent'] ?? '';
    if (!preg_match('/^\d{7}$/', $parent)) {
        geographyError('Kode kabupaten/kota tidak valid.', 400);
    }
    $districts      = bpsRegionList('district', $parent);
    $districtCodes  = array_fill_keys(array_column($districts, 'code'), true);
    $districtNames  = array_fill_keys(array_map(
        static fn($d) => normalizeRegionName($d['name']),
        $districts
    ), true);
    foreach (localDistrictRows($parent) as $localRow) {
        $localName = normalizeRegionName($localRow['nama_wilayah']);
        if (!isset($districtCodes[$localRow['kode_wilayah']]) && !isset($districtNames[$localName])) {
            $districts[]               = [
                'code'   => $localRow['kode_wilayah'],
                'name'   => $localRow['nama_wilayah'],
                'type'   => 'Data admin',
                'source' => 'admin',
            ];
            $districtNames[$localName] = true;
        }
    }
    // TTL 1 jam — bisa bertambah dari admin input
    sendCached(['success' => true, 'message' => 'OK', 'data' => $districts], 3600);
}

/* ── map ─────────────────────────────────────────────────────────────────── */
if ($action !== 'map') {
    geographyError('Action tidak dikenali.', 400);
}

$provinceCode = $_GET['province'] ?? '';
if (!preg_match('/^\d{7}$/', $provinceCode)) {
    geographyError('Pilih provinsi dari daftar resmi BPS.', 422);
}

// Ambil semua daftar sekaligus dalam satu panggilan, cache hasil di variabel lokal
// agar tidak ada duplikasi call bpsRegionList('province') seperti sebelumnya
$allProvinces = bpsRegionList('province');
$province     = requireBpsRegion($allProvinces, $provinceCode);

$regencyCode  = $_GET['regency']  ?? '';
$districtCode = $_GET['district'] ?? '';
$regency      = null;
$district     = null;
$rows         = [];
$geojson      = null;
$mapLevel     = 'regency';
$scopeName    = $province['name'];

if ($regencyCode !== '') {
    if (!preg_match('/^\d{7}$/', $regencyCode)) {
        geographyError('Pilih kabupaten/kota dari daftar resmi BPS.', 422);
    }
    // Satu call saja — tidak perlu validate province ulang
    $allRegencies = bpsRegionList('regency', $provinceCode);
    $regency      = requireBpsRegion($allRegencies, $regencyCode);
    $mapLevel     = 'district';
    $scopeName    = $regency['name'];

    if ($districtCode !== '') {
        if (!preg_match('/^\d{7}$/', $districtCode)) {
            geographyError('Pilih kecamatan dari daftar resmi BPS.', 422);
        }
        $availableDistricts = bpsRegionList('district', $regencyCode);
        $availableDistrictNames = array_fill_keys(array_map(
            static fn($d) => normalizeRegionName($d['name']),
            $availableDistricts
        ), true);
        foreach (localDistrictRows($regencyCode) as $localRow) {
            $localName = normalizeRegionName($localRow['nama_wilayah']);
            if (!isset($availableDistrictNames[$localName])) {
                $availableDistricts[]          = [
                    'code'   => $localRow['kode_wilayah'],
                    'name'   => $localRow['nama_wilayah'],
                    'source' => 'admin',
                ];
                $availableDistrictNames[$localName] = true;
            }
        }
        $district  = requireBpsRegion($availableDistricts, $districtCode);
        $mapLevel  = 'selected-district';
        $scopeName = $district['name'];
    }
}

$statisticsRegion = $regency ?? $province;
$rowLevel         = $regency ? 'district' : 'regency';
$localRows        = $regency ? localDistrictRows($regency['code']) : [];
$statistics       = bpsPopulationData($statisticsRegion['code'], $rowLevel, (bool) $localRows);
$rows             = $statistics['rows'];

if ($regency) {
    $rows = mergeLocalDistrictRows($rows, $localRows, $statistics['year']);
} else {
    foreach ($rows as &$row) {
        $row['sumber_data'] = 'BPS';
        $row['tahun_data']  = $statistics['year'];
    }
    unset($row);
}

if ($regency) {
    $childCodes = array_fill_keys(array_column($rows, 'kode_wilayah'), true);
    foreach ($localRows as $localRow) {
        $childCodes[$localRow['kode_wilayah']] = true;
    }
} else {
    // Reuse $allRegencies bila sudah ada, hindari call ulang
    $childRegions = $allRegencies ?? bpsRegionList('regency', $statisticsRegion['code']);
    $childCodes   = array_fill_keys(array_column($childRegions, 'code'), true);
}

$rows = array_values(array_filter(
    $rows,
    static fn($row) => isset($childCodes[$row['kode_wilayah']])
));
if (!$rows) {
    geographyError('Statistik belum tersedia dari BPS maupun dataset admin untuk wilayah ini.', 404);
}

if ($district) {
    $rows = array_values(array_filter($rows, static fn($row) => $row['kode_wilayah'] === $district['code']));
    if (!$rows) {
        geographyError('Statistik BPS maupun data admin belum tersedia untuk kecamatan yang dipilih.', 404);
    }
}

$provinceWhere = "WADMPR = '" . str_replace("'", "''", $province['name']) . "'";

if ($regency) {
    if ($district && ($district['source'] ?? '') === 'admin') {
        $geojson = appendLocalPointFeatures(
            ['type' => 'FeatureCollection', 'features' => []],
            $rows
        );
    } else {
        $districtBoundaryQuery = bigGeoJson(
            'district',
            [
                $provinceWhere,
                "WADMKK = '" . str_replace("'", "''", $regency['name']) . "'",
            ],
            'districts:' . $regency['code']
        );
        $geojson = ['type' => 'FeatureCollection', 'features' => []];
        foreach ($districtBoundaryQuery['features'] as $feature) {
            $properties = $feature['properties'] ?? [];
            if (trim((string) ($properties['WADMKC'] ?? '')) === '') {
                continue;
            }
            if (normalizeRegionName((string) ($properties['WADMKK'] ?? '')) !== normalizeRegionName($regency['name'])) {
                continue;
            }
            if ($district && normalizeRegionName((string) ($properties['WADMKC'] ?? '')) !== normalizeRegionName($district['name'])) {
                continue;
            }
            $geojson['features'][] = $feature;
        }

        foreach ($geojson['features'] as &$feature) {
            $boundaryName = (string) ($feature['properties']['WADMKC'] ?? '');
            foreach ($rows as $row) {
                if (normalizeRegionName($row['nama_wilayah']) === normalizeRegionName($boundaryName)) {
                    $feature['properties']['kode_wilayah'] = $row['kode_wilayah'];
                    $feature['properties']['nama_wilayah'] = $row['nama_wilayah'];
                    break;
                }
            }
        }
        unset($feature);

        $geojson = appendLocalPointFeatures($geojson, $rows);
        if (!$geojson['features']) {
            geographyError('Polygon BIG atau koordinat kecamatan input admin belum tersedia.', 404);
        }
    }
} else {
    $geojson = bigGeoJson('regency', [$provinceWhere], 'regencies:' . $province['code']);
    $geojson['features'] = array_values(array_filter(
        $geojson['features'],
        static fn($feature) => trim((string) ($feature['properties']['WADMKK'] ?? '')) !== ''
    ));
    if (!$geojson['features']) {
        geographyError('BIG belum menyediakan polygon kabupaten/kota untuk provinsi ini.', 404);
    }
    foreach ($geojson['features'] as &$feature) {
        $boundaryName = (string) ($feature['properties']['WADMKK'] ?? '');
        foreach ($rows as $row) {
            if (normalizeRegionName($row['nama_wilayah']) === normalizeRegionName($boundaryName)) {
                $feature['properties']['kode_wilayah'] = $row['kode_wilayah'];
                $feature['properties']['nama_wilayah'] = $row['nama_wilayah'];
                break;
            }
        }
    }
    unset($feature);
}

if ($district) {
    $scopeName = $district['name'] . ', ' . $regency['name'];
}

// Map data: TTL 30 menit karena mencakup statistik & GeoJSON besar
sendCached([
    'success' => true,
    'message' => 'OK',
    'data'    => [
        'province'       => $province,
        'regency'        => $regency,
        'district'       => $district,
        'level'          => $mapLevel,
        'scope_name'     => $scopeName,
        'stale_data'     => $GLOBALS['geography_stale_data'],
        'stale_sources'  => $GLOBALS['geography_stale_sources'],
        'statistic_year' => $statistics['year'],
        'statistic_title'=> $statistics['title'],
        'data_sources'   => array_values(array_unique(array_map(
            static fn($row) => $row['sumber_data'] . (isset($row['tahun_data']) ? ' (' . $row['tahun_data'] . ')' : ''),
            $rows
        ))),
        'source'         => [
            'statistics'      => 'Badan Pusat Statistik (BPS)',
            'statistics_url'  => 'https://webapi.bps.go.id/documentation/',
            'boundaries'      => 'Badan Informasi Geospasial (BIG), RBI Batas Wilayah Administrasi',
            'boundaries_url'  => 'https://geoservices.big.go.id/rbi/rest/services/BATASWILAYAH/',
        ],
        'regions'        => $rows,
        'geojson'        => $geojson,
    ],
], 1800);
