#!/usr/bin/env python3
import subprocess
import os

# Work from root
root_dir = 'd:\\Git\\Bitemporal_2026'
file_path = os.path.join(root_dir, 'bitemp_register_v06', 'docs', 'presentaties', 'apidays', 'FOST & apidays Amsterdam 2026 - Volledige Recap 17p.pptx')

# Get the file from git HEAD
result = subprocess.run(
    ['git', 'show', 'HEAD:bitemp_register_v06/docs/presentaties/apidays/FOST & apidays Amsterdam 2026 - Volledige Recap 17p.pptx'],
    capture_output=True,
    cwd=root_dir
)

if result.returncode == 0:
    # Backup current version
    if os.path.exists(file_path):
        os.rename(file_path, file_path + '.backup')
        print('Current version backed up')
    
    # Write original from git
    with open(file_path, 'wb') as f:
        f.write(result.stdout)
    print('Original restored from git!')
else:
    print(f'Error: {result.stderr.decode()}')
