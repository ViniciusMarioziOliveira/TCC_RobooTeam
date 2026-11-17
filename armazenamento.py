# -*- coding: utf-8 -*-
"""Imagens e apresentacoes das trilhas guardadas no Supabase Storage.

A professora envia o arquivo pelo painel, o servidor confere o que ele e de
verdade (pelos primeiros bytes, nao pela extensao) e o grava no bucket publico
``trilha-imagens`` usando a chave secreta do projeto (``SUPABASE_SECRET_KEY``).
Os alunos abrem o arquivo pelo link publico, sem precisar de login no Supabase.

Tipos aceitos:
- imagens PNG, JPG, WEBP e GIF (tambem os slides de um PDF, que o navegador da
  professora transforma em imagens antes de enviar);
- apresentacoes do PowerPoint (.pptx), mostradas no visualizador do Office.
"""

import io
import json
import os
import re
import urllib.error
import urllib.request
import uuid
import zipfile

BUCKET = os.getenv("SUPABASE_BUCKET", "trilha-imagens")
TAMANHO_MAXIMO = 4 * 1024 * 1024

TIPO_PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
EXTENSOES = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    TIPO_PPTX: "pptx",
}
EXTENSOES_DE_IMAGEM = ("png", "jpg", "webp", "gif")

_CAMINHO_VALIDO = re.compile(r"^trilhas/\d+/[0-9a-f]{32}\.(png|jpg|webp|gif|pptx)$")
_SLIDE_DO_PPTX = re.compile(r"^ppt/slides/slide\d+\.xml$")


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
    caminho = _caminho_da_url(endereco)
    return bool(caminho) and caminho.endswith(EXTENSOES_DE_IMAGEM)


def eh_apresentacao_da_trilha(endereco):
    """Aceita apenas links de apresentacoes (.pptx) enviadas pelo proprio painel."""
    caminho = _caminho_da_url(endereco)
    return bool(caminho) and caminho.endswith(".pptx")


def _slides_do_pptx(conteudo):
    """Quantidade de slides se o arquivo for um .pptx de verdade (senao, None).

    So le a lista de arquivos do zip (nada e descompactado), entao um zip
    malicioso nao consegue ocupar a memoria do servidor.
    """
    try:
        with zipfile.ZipFile(io.BytesIO(conteudo)) as pacote:
            nomes = pacote.namelist()
    except (zipfile.BadZipFile, ValueError):
        return None
    if "ppt/presentation.xml" not in nomes:
        return None
    return sum(1 for nome in nomes if _SLIDE_DO_PPTX.match(nome))


def tipo_do_arquivo(conteudo):
    """Descobre o formato pelos primeiros bytes (nao confia na extensao)."""
    if conteudo.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if conteudo.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if conteudo[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if conteudo[:4] == b"RIFF" and conteudo[8:12] == b"WEBP":
        return "image/webp"
    if conteudo.startswith(b"PK\x03\x04") and _slides_do_pptx(conteudo) is not None:
        return TIPO_PPTX
    return None


def enviar_arquivo(professor_id, conteudo):
    """Grava a imagem ou a apresentacao no bucket e devolve o link publico.

    Devolve ``{"url", "tipo"}`` com tipo "imagem" ou "apresentacao"; nas
    apresentacoes vem tambem ``slides`` (quantos slides o arquivo tem).
    """
    url, chave = _configuracao()
    if not (url and chave):
        raise ErroImagem("O envio de arquivos ainda não foi configurado no servidor.", 503)
    if not conteudo:
        raise ErroImagem("Escolha um arquivo para enviar.")
    if len(conteudo) > TAMANHO_MAXIMO:
        raise ErroImagem(
            "O arquivo pode ter no máximo 4 MB. Apresentações grandes: salve como PDF e envie o PDF.",
            413,
        )

    tipo = tipo_do_arquivo(conteudo)
    if not tipo:
        raise ErroImagem("Envie uma imagem (PNG, JPG, WEBP ou GIF), um PDF ou uma apresentação .pptx.")

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
    except urllib.error.HTTPError as erro:
        if tipo == TIPO_PPTX and erro.code in (400, 415, 422):
            # o bucket ainda nao libera .pptx (falta rodar o supabase/schema.sql atualizado)
            raise ErroImagem(
                "O armazenamento ainda não aceita apresentações .pptx. "
                "Rode o arquivo supabase/schema.sql atualizado no Supabase.",
                502,
            )
        raise ErroImagem("Não foi possível guardar o arquivo agora. Tente de novo.", 502)
    except (urllib.error.URLError, TimeoutError):
        raise ErroImagem("Não foi possível guardar o arquivo agora. Tente de novo.", 502)

    resultado = {"url": _prefixo_publico() + caminho, "tipo": "imagem"}
    if tipo == TIPO_PPTX:
        resultado.update(tipo="apresentacao", slides=_slides_do_pptx(conteudo))
    return resultado


def remover_arquivos(enderecos):
    """Apaga do bucket os arquivos que sairam da trilha (sem travar a resposta se falhar)."""
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
