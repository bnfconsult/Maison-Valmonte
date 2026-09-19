#!/usr/bin/env python3
"""Serveur local du site (dossier site/), sans cache : chaque rechargement montre la dernière version.

Usage : python3 outils/serveur.py [port]   puis ouvrir http://localhost:8080
"""
import functools
import http.server
import os
import sys


class SansCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
racine = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'site')
serveur = http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(SansCache, directory=racine))
print('Site servi sur http://localhost:%d' % port, flush=True)
serveur.serve_forever()
