import http.server, ssl, sys

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8443

server = http.server.HTTPServer(('0.0.0.0', port), http.server.SimpleHTTPRequestHandler)
server.socket = ssl.wrap_socket(server.socket, certfile='server.pem', server_side=True)
print(f'HTTPS server running at https://localhost:{port}')
print('NOTE: Browser will show a security warning — click "Advanced" > "Proceed" to continue.')
server.serve_forever()
