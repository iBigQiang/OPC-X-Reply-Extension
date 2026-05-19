# pack.ps1 — Build OPC-X-Reply-Extension.zip with correct UTF-8 file names.
# Why .NET API instead of Compress-Archive: PowerShell's Compress-Archive on Windows
# writes non-ASCII file names with the wrong byte encoding even though it sets Bit11=1
# (UTF-8 flag), so unzip tools see garbled CJK names.
# Why this script avoids CJK string literals: PowerShell 7 on Windows still reads
# .ps1 files using the system ANSI code page when there is no BOM, which would corrupt
# any hard-coded CJK string. We enumerate CJK files via wildcards (Get-ChildItem) so
# the names come from the filesystem (UTF-16 native), not from the .ps1 source.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$Target = 'OPC-X-Reply-Extension.zip'
if (Test-Path $Target) { Remove-Item $Target -Force }

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$absTarget = Join-Path $ScriptDir $Target
$zip = [System.IO.Compression.ZipFile]::Open(
    $absTarget,
    [System.IO.Compression.ZipArchiveMode]::Create,
    [System.Text.Encoding]::UTF8
)

try {
    $level = [System.IO.Compression.CompressionLevel]::Optimal

    # 1) ASCII-named source files
    $asciiFiles = @(
        'manifest.json', 'background.js', 'content.js', 'content.css',
        'options.html', 'options.js', 'README.md'
    )
    foreach ($f in $asciiFiles) {
        $full = Join-Path $ScriptDir $f
        if (-not (Test-Path $full)) { throw "Missing: $f" }
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $full, $f, $level) | Out-Null
    }

    # 2) Top-level CJK .txt files (whitelist: .txt at repo root, name has NO digit)
    #    This intentionally excludes private inspiration files like "额外提示词1.txt"
    #    while including the published "禁用词.txt" and "额外提示词.txt".
    Get-ChildItem -Path $ScriptDir -Filter '*.txt' -File |
        Where-Object { $_.Name -notmatch '\d' } |
        ForEach-Object {
            $rel = $_.Name
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $rel, $level) | Out-Null
        }

    # 3) Entire img/ directory, preserving the img/ prefix.
    #    Skip backup background images named like `options_bg2.png`, `options_bg3.png` ...
    #    (the active background is `options_bg.png`; numeric-suffixed siblings are local
    #    备选图 the user keeps around but doesn't ship — same spirit as the .txt whitelist
    #    above which excludes 额外提示词1.txt / 额外提示词2.txt).
    Get-ChildItem -Path (Join-Path $ScriptDir 'img') -Recurse -File |
        Where-Object { $_.Name -notmatch '^options_bg\d+\.png$' } |
        ForEach-Object {
            $rel = 'img/' + $_.Name
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $rel, $level) | Out-Null
        }
} finally {
    $zip.Dispose()
}

$sizeKB = [int]((Get-Item $absTarget).Length / 1024)
Write-Host "[pack] OPC-X-Reply-Extension.zip ready ($sizeKB KB)"
