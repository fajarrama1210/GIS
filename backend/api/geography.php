<?php
// Hierarki kode wilayah dan statistik BPS dipadukan dengan polygon resmi BIG.

require_once __DIR__ . '/../koneksi.php';
require_once __DIR__ . '/_middleware.php';
require_once __DIR__ . '/_geography.php';

$allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins, true)) {
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

$action = $_GET['action'] ?? '';
if ($action === 'provinces') {
    jsonResponse(['success' => true, 'message' => 'OK', 'data' => bpsRegionList('province')]);
}

if ($action === 'regencies' || $action === 'districts') {
    $parent = $_GET['parent'] ?? '';
    if ($action === 'regencies') {
        requireBpsRegion(bpsRegionList('province'), $parent);
        jsonResponse([
            'success' => true,
            'message' => 'OK',
            'data' => bpsRegionList('regency', $parent),
        ]);
    }
    if (!preg_match('/^\d{7}$/', $parent)) {
        geographyError('Kode kabupaten/kota tidak valid.', 400);
    }
    $parentProvince = substr($parent, 0, 2) . '00000';
    requireBpsRegion(bpsRegionList('province'), $parentProvince);
    requireBpsRegion(bpsRegionList('regency', $parentProvince), $parent);
    $districts = bpsRegionList('district', $parent);
    $districtCodes = array_fill_keys(array_column($districts, 'code'), true);
    $districtNames = array_fill_keys(array_map(
        static fn($district) => normalizeRegionName($district['name']),
        $districts
    ), true);
    foreach (localDistrictRows($parent) as $localRow) {
        $localName = normalizeRegionName($localRow['nama_wilayah']);
        if (!isset($districtCodes[$localRow['kode_wilayah']]) && !isset($districtNames[$localName])) {
            $districts[] = [
                'code' => $localRow['kode_wilayah'],
                'name' => $localRow['nama_wilayah'],
                'type' => 'Data admin',
                'source' => 'admin',
            ];
            $districtNames[$localName] = true;
        }
    }
    jsonResponse([
        'success' => true,
        'message' => 'OK',
        'data' => $districts,
    ]);
}

if ($action !== 'map') {
    geographyError('Action tidak dikenali.', 400);
}

$provinceCode = $_GET['province'] ?? '';
if (!preg_match('/^\d{7}$/', $provinceCode)) {
    geographyError('Pilih provinsi dari daftar resmi BPS.', 422);
}
$province = requireBpsRegion(bpsRegionList('province'), $provinceCode);

$regencyCode = $_GET['regency'] ?? '';
$districtCode = $_GET['district'] ?? '';
$regency = null;
$district = null;
$rows = [];
$geojson = null;
$mapLevel = 'regency';
$scopeName = $province['name'];

if ($regencyCode !== '') {
    if (!preg_match('/^\d{7}$/', $regencyCode)) {
        geographyError('Pilih kabupaten/kota dari daftar resmi BPS.', 422);
    }
    $regency = requireBpsRegion(bpsRegionList('regency', $provinceCode), $regencyCode);
    $mapLevel = 'district';
    $scopeName = $regency['name'];

    if ($districtCode !== '') {
        if (!preg_match('/^\d{7}$/', $districtCode)) {
            geographyError('Pilih kecamatan dari daftar resmi BPS.', 422);
        }
        $availableDistricts = bpsRegionList('district', $regencyCode);
        $availableDistrictNames = array_fill_keys(array_map(
            static fn($availableDistrict) => normalizeRegionName($availableDistrict['name']),
            $availableDistricts
        ), true);
        foreach (localDistrictRows($regencyCode) as $localRow) {
            $localName = normalizeRegionName($localRow['nama_wilayah']);
            if (!isset($availableDistrictNames[$localName])) {
                $availableDistricts[] = [
                    'code' => $localRow['kode_wilayah'],
                    'name' => $localRow['nama_wilayah'],
                    'source' => 'admin',
                ];
                $availableDistrictNames[$localName] = true;
            }
        }
        $district = requireBpsRegion($availableDistricts, $districtCode);
        $mapLevel = 'selected-district';
        $scopeName = $district['name'];
    }
}

$statisticsRegion = $regency ?? $province;
$rowLevel = $regency ? 'district' : 'regency';
$localRows = $regency ? localDistrictRows($regency['code']) : [];
$statistics = bpsPopulationData($statisticsRegion['code'], $rowLevel, (bool) $localRows);
$rows = $statistics['rows'];
if ($regency) {
    $rows = mergeLocalDistrictRows($rows, $localRows, $statistics['year']);
} else {
    foreach ($rows as &$row) {
        $row['sumber_data'] = 'BPS';
        $row['tahun_data'] = $statistics['year'];
    }
    unset($row);
}
if ($regency) {
    $childCodes = array_fill_keys(array_column($rows, 'kode_wilayah'), true);
    foreach ($localRows as $localRow) {
        $childCodes[$localRow['kode_wilayah']] = true;
    }
} else {
    $childRegions = bpsRegionList('regency', $statisticsRegion['code']);
    $childCodes = array_fill_keys(array_column($childRegions, 'code'), true);
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
    $geojson['type'] = 'FeatureCollection';
    $geojson['features'] = [];
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

jsonResponse([
    'success' => true,
    'message' => 'OK',
    'data' => [
        'province' => $province,
        'regency' => $regency,
        'district' => $district,
        'level' => $mapLevel,
        'scope_name' => $scopeName,
        'stale_data' => $GLOBALS['geography_stale_data'],
        'stale_sources' => $GLOBALS['geography_stale_sources'],
        'statistic_year' => $statistics['year'],
        'statistic_title' => $statistics['title'],
        'data_sources' => array_values(array_unique(array_map(
            static fn($row) => $row['sumber_data'] . (isset($row['tahun_data']) ? ' (' . $row['tahun_data'] . ')' : ''),
            $rows
        ))),
        'source' => [
            'statistics' => 'Badan Pusat Statistik (BPS)',
            'statistics_url' => 'https://webapi.bps.go.id/documentation/',
            'boundaries' => 'Badan Informasi Geospasial (BIG), RBI Batas Wilayah Administrasi',
            'boundaries_url' => 'https://geoservices.big.go.id/rbi/rest/services/BATASWILAYAH/',
        ],
        'regions' => $rows,
        'geojson' => $geojson,
    ],
]);
