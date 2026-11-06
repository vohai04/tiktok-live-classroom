"""Linux/Windows JSON-lines voice worker; Edge online with local eSpeak fallback."""
import asyncio
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

import edge_tts

VOICE = os.environ.get('CLASSROOM_VOICE', 'vi-VN-HoaiMyNeural')
ESPEAK = shutil.which('espeak-ng')
offline_until = 0
sys.stdin.reconfigure(encoding='utf-8')
sys.stdout.reconfigure(encoding='utf-8')

def emit(data):
    print(json.dumps(data, ensure_ascii=False), flush=True)

async def online(text, target):
    await asyncio.wait_for(edge_tts.Communicate(text, VOICE, rate='+5%').save(str(target)), timeout=8)

emit({'ready': True, 'voice': VOICE})
for line in sys.stdin:
    job = {}
    try:
        job = json.loads(line)
        target = Path(job['file'])
        temporary = target.with_suffix('.part.mp3')
        try:
            if os.environ.get('CLASSROOM_TTS_OFFLINE') == '1' or time.monotonic() < offline_until:
                raise RuntimeError('Use local voice')
            asyncio.run(online(job['text'], temporary))
            if temporary.stat().st_size < 100:
                raise RuntimeError('Empty audio')
            temporary.replace(target)
            emit({'id': job['id'], 'ok': True, 'format': 'mp3', 'voice': VOICE})
        except Exception:
            temporary.unlink(missing_ok=True)
            if not ESPEAK:
                raise RuntimeError('Không kết nối được giọng Edge; chưa cài espeak-ng để đọc dự phòng.')
            offline_until = time.monotonic() + 60
            target = target.with_suffix('.wav')
            temporary = target.with_suffix('.part.wav')
            subprocess.run([ESPEAK, '-v', 'vi', '-s', '165', '-w', str(temporary), '--stdin'], input=job['text'], text=True, encoding='utf-8', check=True, timeout=15, capture_output=True)
            temporary.replace(target)
            emit({'id': job['id'], 'ok': True, 'format': 'wav', 'voice': 'eSpeak NG tiếng Việt (dự phòng)'})
    except Exception as error:
        emit({'id': job.get('id'), 'ok': False, 'error': str(error)[:200]})
