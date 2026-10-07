# -*- coding: utf-8 -*-
"""Imagens das trilhas guardadas no Supabase Storage.

A professora envia a imagem pelo painel, o servidor confere se e mesmo uma
imagem e a grava no bucket publico ``trilha-imagens`` usando a chave secreta
do projeto (``SUPABASE_SECRET_KEY``). Os alunos abrem a imagem pelo link
publico, sem precisar de login no Supabase.
"""

import json
import os
import re
import urllib.error
import urllib.request
import uuid

BUCKET = os.getenv("SUPABASE_BUCKET", "trilha-imagens")
TAMANHO_MAXIMO = 4 * 1024 * 1024
EXTENSOES = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif"}
_CAMINHO_VALIDO = re.compile(r"^trilhas/\d+/[0-9a-f]{32}\.(png|jpg|webp|gif)$")


class ErroImagem(ValueError):
    """Erro com mensagem pronta para a interface e status HTTP sugerido."""

    def __init__(self, mensagem, status=400):
        super().__init__(mensagem)
        self.status = status


def _configuracao():
    url = (os.getenv("SUPABASE_URL") or "").strip().rstrip("/")
    chave = (os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    return url, chave


def _cabecalhos(chave, **extras):
    return {"apikey": chave, "Authorization": f"Bearer {chave}", **extras}


def configurado():
    url, chave = _configuracao()
    return bool(url and chave)


def _prefixo_publico():
    url, _ = _configuracao()
    return f"{url}/storage/v1/object/public/{BUCKET}/" if url else None


def _caminho_da_url(endereco):
    prefixo = _prefixo_publico()
    endereco = str(endereco or "").strip()
    if not prefixo or not endereco.startswith(prefixo):
        return None
    caminho = endereco[len(prefixo):]
    return caminho if _CAMINHO_VALIDO.match(caminho) else None


def eh_imagem_da_trilha(endereco):
    """Aceita apenas links de imagens enviadas pelo proprio painel."""
    return _caminho_da_url(endereco) is not None


def tipo_da_imagem(conteudo):
    """Descobre o formato pelos primeiros bytes (nao confia na extensao)."""
    if conteudo.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if conteudo.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if conteudo[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if conteudo[:4] == b"RIFF" and conteudo[8:12] == b"WEBP":
        return "image/webp"
    return None


def enviar_imagem(professor_id, conteudo):
    """Grava a imagem no bucket e devolve o link publico."""
    url, chave = _configuracao()
    if not (url and chave):
        raise ErroImagem("O envio de imagens ainda não foi configurado no servidor.", 503)
    if not conteudo:
        raise ErroImagem("Escolha uma imagem para enviar.")
    if len(conteudo) > TAMANHO_MAXIMO:
        raise ErroImagem("A imagem pode ter no máximo 4 MB.", 413)

    tipo = tipo_da_imagem(conteudo)
    if not tipo:
        raise ErroImagem("Envie uma imagem PNG, JPG, WEBP ou GIF.")

    caminho = f"trilhas/{int(professor_id)}/{uuid.uuid4().hex}.{EXTENSOES[tipo]}"
    requisicao = urllib.request.Request(
        f"{url}/storage/v1/object/{BUCKET}/{caminho}",
        data=conteudo,
        method="POST",
        headers=_cabecalhos(chave, **{"Content-Type": tipo, "Cache-Control": "max-age=31536000"}),
    )
    try:
        with urllib.request.urlopen(requisicao, timeout=20):
            pass
    except (urllib.error.URLError, TimeoutError):
        raise ErroImagem("Não foi possível guardar a imagem agora. Tente de novo.", 502)

    return _prefixo_publico() + caminho


def remover_imagens(enderecos):
    """Apaga do bucket as imagens que sairam da trilha (sem travar a resposta se falhar)."""
    url, chave = _configuracao()
    caminhos = sorted({c for c in map(_caminho_da_url, enderecos or []) if c})
    if not (url and chave and caminhos):
        return

    requisicao = urllib.request.Request(
        f"{url}/storage/v1/object/{BUCKET}",
        data=json.dumps({"prefixes": caminhos}).encode("utf-8"),
        method="DELETE",
        headers=_cabecalhos(chave, **{"Content-Type": "application/json"}),
    )
    try:
        with urllib.request.urlopen(requisicao, timeout=10):
            pass
    except (urllib.error.URLError, TimeoutError):
        pass
