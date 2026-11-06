$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Speech
$classroomSpeaker = [System.Speech.Synthesis.SpeechSynthesizer]::new()
$classroomVoice = $classroomSpeaker.GetInstalledVoices() | Where-Object {$_.VoiceInfo.Culture.Name -eq 'vi-VN'} | Select-Object -First 1
if (-not $classroomVoice) { throw 'No Vietnamese Windows speech voice installed.' }
$classroomSpeaker.SelectVoice($classroomVoice.VoiceInfo.Name)
$classroomSpeaker.Rate = 1
@{ready=$true;voice=$classroomVoice.VoiceInfo.Name} | ConvertTo-Json -Compress | Write-Output
while ($null -ne ($classroomLine = [Console]::ReadLine())) {
  try {
    $classroomJob = $classroomLine | ConvertFrom-Json
    $classroomSpeaker.SetOutputToWaveFile($classroomJob.file)
    $classroomSpeaker.Speak([string]$classroomJob.text)
    $classroomSpeaker.SetOutputToNull()
    @{id=$classroomJob.id;ok=$true} | ConvertTo-Json -Compress | Write-Output
  } catch {
    @{id=$classroomJob.id;ok=$false;error=$_.Exception.Message} | ConvertTo-Json -Compress | Write-Output
  }
}
$classroomSpeaker.Dispose()
