@echo off & cd /d "%~dp0" & title Servidor LAN - Catalogo Mia and Paper & where python >nul 2>nul || (echo [ERRO] Python nao encontrado no PATH do sistema. & pause & exit /b 1) & python -u -x "%~f0" %* & exit /b %errorlevel%
# -*- coding: utf-8 -*-
import sys
import os
import socket
import threading
import time
import webbrowser
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

# Suporte UTF-8 e buffer de linha imediato
try:
    sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)
except Exception:
    pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE_DIR)

def get_lan_ip():
    """Deteta o IP local da máquina na rede LAN/Wi-Fi."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'

def find_free_port(start_port=8080, max_port=8150):
    """Encontra uma porta TCP livre na rede local."""
    for port in range(start_port, max_port):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                s.bind(('0.0.0.0', port))
                return port
        except OSError:
            continue
    return 8080

def open_browser_delayed(url):
    time.sleep(1.2)
    try:
        webbrowser.open(url)
    except Exception:
        pass

class CustomHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Desativar cache para garantir que atualizações nos ficheiros aparecem logo
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

def run_server():
    port = find_free_port()
    lan_ip = get_lan_ip()
    local_url = f"http://localhost:{port}/"
    lan_url = f"http://{lan_ip}:{port}/"

    server_address = ('0.0.0.0', port)
    
    try:
        httpd = ThreadingHTTPServer(server_address, CustomHandler)
    except Exception as e:
        print(f"[ERRO] Não foi possível iniciar o servidor na porta {port}: {e}", flush=True)
        input("Pressione Enter para sair...")
        sys.exit(1)

    print("=" * 72, flush=True)
    print("         MIA & PAPER - SERVIDOR LOCAL DO CATÁLOGO DE ARGOLAS         ", flush=True)
    print("=" * 72, flush=True)
    print(flush=True)
    print("  [✓] Servidor HTTP ativo e disponível na sua rede local (LAN)!", flush=True)
    print(f"  [✓] Diretoria servida: {BASE_DIR}", flush=True)
    print(flush=True)
    print("  -> NESTE COMPUTADOR (Localhost):", flush=True)
    print(f"     {local_url}", flush=True)
    print(flush=True)
    print("  -> NO SEU TELEMÓVEL / TABLET / OUTROS DISPOSITIVOS (Wi-Fi / LAN):", flush=True)
    print(f"     {lan_url}", flush=True)
    print(flush=True)
    print("-" * 72, flush=True)
    print("  INSTRUÇÕES E DICAS:", flush=True)
    print("  1. No telemóvel/tablet, abra o navegador (Safari/Chrome) e escreva:", flush=True)
    print(f"     {lan_url}", flush=True)
    print("  2. Certifique-se de que os dispositivos estão ligados à mesma rede Wi-Fi.", flush=True)
    print("  3. Se a Firewall do Windows solicitar confirmação, selecione 'Permitir'.", flush=True)
    print("  4. Para ENCERRAR o servidor a qualquer momento, prima [Ctrl + C].", flush=True)
    print("=" * 72, flush=True)
    print(flush=True)
    print("A abrir o catálogo no navegador do computador...", flush=True)
    print("Registo de acessos em tempo real (pedidos HTTP):", flush=True)
    print("-" * 72, flush=True)

    # Abrir navegador automaticamente na máquina local
    threading.Thread(target=open_browser_delayed, args=(local_url,), daemon=True).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\n" + "=" * 72, flush=True)
        print("  [!] Servidor encerrado com sucesso pelo utilizador (Ctrl + C).", flush=True)
        print("=" * 72, flush=True)
        httpd.server_close()
        time.sleep(1)

if __name__ == '__main__':
    run_server()
