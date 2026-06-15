#!/usr/bin/env python3
import subprocess
import os

root_dir = 'd:\\Git\\Bitemporal_2026'
file_path = os.path.join(root_dir, 'bitemp_register_v06', 'docs', 'presentaties', 'apidays', 'FOST & apidays Amsterdam 2026 - Volledige Recap 17p.pptx')

# Restore from git
result = subprocess.run(
    ['git', 'show', 'HEAD:bitemp_register_v06/docs/presentaties/apidays/FOST & apidays Amsterdam 2026 - Volledige Recap 17p.pptx'],
    capture_output=True,
    cwd=root_dir
)

if result.returncode == 0:
    with open(file_path, 'wb') as f:
        f.write(result.stdout)
    print('✓ Origineel bestand hersteld!')
else:
    print(f'Error: {result.stderr.decode()}')
