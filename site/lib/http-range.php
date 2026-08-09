<?php
/** Devolve null sem Range, false para Range invalido, ou array(start, end). */
function mp_http_byte_range($header, $size)
{
    $header = trim((string)$header);
    $size = (int)$size;
    if ($header === '') {
        return null;
    }
    if ($size <= 0 || !preg_match('/^bytes=(\d*)-(\d*)$/', $header, $matches)) {
        return false;
    }
    if ($matches[1] === '' && $matches[2] === '') {
        return false;
    }

    if ($matches[1] === '') {
        $suffix = (int)$matches[2];
        if ($suffix <= 0) {
            return false;
        }
        return array(max(0, $size - $suffix), $size - 1);
    }

    $start = (int)$matches[1];
    if ($start < 0 || $start >= $size) {
        return false;
    }
    $end = $matches[2] === '' ? $size - 1 : (int)$matches[2];
    if ($end < $start) {
        return false;
    }
    return array($start, min($size - 1, $end));
}

function mp_http_reject_invalid_range($size)
{
    http_response_code(416);
    header('Content-Range: bytes */' . max(0, (int)$size));
    header('Content-Length: 0');
    exit;
}

