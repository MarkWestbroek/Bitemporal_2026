#!/usr/bin/env python3
import subprocess
import os

os.chdir('d:\\Git\\Bitemporal_2026\\bitemp_register_v06\\docs\\presentaties\\apidays')

# List files in git
result = subprocess.run(['git', 'ls-files'], capture_output=True, text=True)
print('Files in git:')
for line in result.stdout.split('\n'):
    if 'pptx' in line.lower():
        print(f'  {line}')
