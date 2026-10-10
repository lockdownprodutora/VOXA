import os
import zipfile

zip_filename = "lockdown-site-codigo.zip"
files_to_include = [
    "package.json",
    "bun.lock",
    "server.ts",
    "tsconfig.json",
    "vite.config.ts",
    "index.html",
    "firebase.json",
    "firestore.rules",
    "storage.rules",
    "README.md",
    ".env.example",
    "firebase-blueprint.json",
    "firebase-applet-config.json",
]
dirs_to_include = [
    "src"
]

print(f"Starting zip creation: {zip_filename}")

with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
    # Add root files
    for file in files_to_include:
        if os.path.exists(file):
            zipf.write(file, file)
            print(f"Added file: {file}")
        else:
            print(f"Warning: file {file} not found")
    
    # Add directories recursively
    for directory in dirs_to_include:
        if os.path.exists(directory):
            for root, dirs, files in os.walk(directory):
                if any(x in root.split(os.sep) for x in ["node_modules", "dist", ".git", "__pycache__"]):
                    continue
                for file in files:
                    file_path = os.path.join(root, file)
                    rel_path = os.path.relpath(file_path, os.getcwd())
                    zipf.write(file_path, rel_path)
                    print(f"Added: {rel_path}")

# Quick integrity check: list the files in the generated ZIP
print("\nVerifying ZIP integrity...")
with zipfile.ZipFile(zip_filename, 'r') as zipf:
    num_files = len(zipf.namelist())
    print(f"Success! ZIP file contains {num_files} files.")
