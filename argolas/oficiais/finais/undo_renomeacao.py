"""
Script de reversão (UNDO) automática para restaurar os nomes originais dos ficheiros.
Execução: python undo_renomeacao.py
"""
import os, json

base = os.path.dirname(os.path.abspath(__file__))
log_file = os.path.join(base, "log_renomeacao.json")

if not os.path.exists(log_file):
    print("ERRO: Ficheiro de log log_renomeacao.json não encontrado!")
    exit(1)

with open(log_file, "r", encoding="utf-8") as f:
    entries = json.load(f)

print(f"A restaurar {len(entries)} ficheiros para os nomes originais...")
reverted = 0
for e in entries:
    current_path = os.path.join(base, e["folder"], e["new_name"])
    original_path = os.path.join(base, e["folder"], e["old_name"])
    
    if os.path.exists(current_path):
        os.rename(current_path, original_path)
        print(f" [OK] {e['new_name']} -> {e['old_name']}")
        reverted += 1
    elif os.path.exists(original_path):
        print(f" [SKIP] O ficheiro já se chama {e['old_name']}")
    else:
        print(f" [ERRO] Ficheiro não encontrado: {current_path}")

print(f"Concluído! {reverted} ficheiros restaurados.")
