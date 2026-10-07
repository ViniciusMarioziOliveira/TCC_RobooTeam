# -*- coding: utf-8 -*-
"""Persistencia e validacao das atividades da trilha.

A trilha padrao vive em ``trilha_conteudo.ATIVIDADES_PADRAO``. Quando um
professor edita a trilha, uma copia personalizada dela e gravada na tabela
``trilha_atividades`` do Supabase, uma linha por etapa. Os alunos que estao na
sala desse professor passam a ver a trilha personalizada; quem ainda nao entrou
em nenhuma sala continua vendo a trilha padrao.

Os blocos de leitura podem ter uma imagem (``image``) enviada pelo painel e
guardada no Supabase Storage (veja ``armazenamento.py``).
"""

import copy
import re

from psycopg.types.json import Jsonb

import armazenamento
import db
from trilha_conteudo import (
    ATIVIDADES_PADRAO,
    CORES_DISPONIVEIS,
    ROTULOS_MINIJOGO,
    TIPOS_MINIJOGO,
)

LIMITES = {
    "secoes": (1, 8),
    "quiz": (1, 10),
    "opcoes": (2, 5),
    "pares": (3, 8),
    "palavras": (3, 8),
    "variacoes": (1, 5),
}


class ErroDeValidacao(ValueError):
    """Erro de validacao com mensagem pronta para exibir ao professor."""


# ---------------------------------------------------------------------------
# Leitura e gravacao no banco
# ---------------------------------------------------------------------------

_COLUNAS = (
    "id", "period", "title", "description", "color", "eyebrow",
    "lesson_title", "intro", "sections", "quiz", "minigame",
)
_COLUNAS_JSON = {"sections", "quiz", "minigame"}


def _carregar(cursor, professor_id):
    cursor.execute(
        f"""
        select {", ".join(_COLUNAS)}
          from public.trilha_atividades
         where professor_id = %s
         order by posicao, id
        """,
        (int(professor_id),),
    )
    return [dict(linha) for linha in cursor.fetchall()]


def _gravar(cursor, professor_id, atividades):
    """Substitui a trilha do professor pelas atividades, na ordem da lista."""
    cursor.execute("delete from public.trilha_atividades where professor_id = %s", (int(professor_id),))
    cursor.executemany(
        f"""
        insert into public.trilha_atividades (professor_id, posicao, {", ".join(_COLUNAS)})
        values ({", ".join(["%s"] * (len(_COLUNAS) + 2))})
        """,
        [
            (
                int(professor_id),
                posicao,
                *(Jsonb(item[coluna]) if coluna in _COLUNAS_JSON else item[coluna] for coluna in _COLUNAS),
            )
            for posicao, item in enumerate(atividades, start=1)
        ],
    )


def _imagens(atividades):
    return {
        secao["image"]
        for atividade in atividades
        for secao in atividade.get("sections", [])
        if secao.get("image")
    }


# ---------------------------------------------------------------------------
# Leitura da trilha
# ---------------------------------------------------------------------------

def atividades_padrao():
    """Copia intocada da trilha padrao definida no codigo."""
    return copy.deepcopy(ATIVIDADES_PADRAO)


def trilha_do_professor(professor_id):
    """Trilha personalizada do professor ou uma copia da trilha padrao."""
    if professor_id is None:
        return atividades_padrao()

    with db.transacao() as cursor:
        personalizada = _carregar(cursor, professor_id)
    return personalizada or atividades_padrao()


def usa_trilha_personalizada(professor_id):
    if professor_id is None:
        return False
    with db.transacao() as cursor:
        cursor.execute(
            "select exists (select 1 from public.trilha_atividades where professor_id = %s) as existe",
            (int(professor_id),),
        )
        return cursor.fetchone()["existe"]


def trilha_para_aluno(aluno):
    """Trilha que o aluno enxerga, resolvida pelo professor da sala dele."""
    return trilha_do_professor((aluno or {}).get("professor_id"))


def buscar_atividade(atividades, atividade_id):
    try:
        alvo = int(atividade_id)
    except (TypeError, ValueError):
        return None
    return next((item for item in atividades if int(item["id"]) == alvo), None)


def ids_das_atividades(atividades):
    return [int(item["id"]) for item in atividades]


def normalizar_concluidas(atividades, concluidas):
    """Mantem apenas ids que ainda existem na trilha, em ordem."""
    validos = set(ids_das_atividades(atividades))
    resultado = set()

    for item in concluidas or []:
        try:
            item = int(item)
        except (TypeError, ValueError):
            continue
        if item in validos:
            resultado.add(item)

    return sorted(resultado)


def primeira_pendente(atividades, concluidas):
    """Id da proxima etapa que o aluno precisa fazer (ou None se acabou)."""
    concluidas = set(normalizar_concluidas(atividades, concluidas))
    return next(
        (int(item["id"]) for item in atividades if int(item["id"]) not in concluidas),
        None,
    )


# ---------------------------------------------------------------------------
# Validacao / normalizacao do que o professor envia
# ---------------------------------------------------------------------------

def _texto(valor, campo, minimo=1, maximo=400, obrigatorio=True, padrao=""):
    texto = " ".join(str(valor or "").split())

    if not texto:
        if obrigatorio:
            raise ErroDeValidacao(f"Preencha o campo {campo}.")
        return padrao

    if len(texto) < minimo:
        raise ErroDeValidacao(f"O campo {campo} precisa ter ao menos {minimo} caracteres.")
    if len(texto) > maximo:
        raise ErroDeValidacao(f"O campo {campo} pode ter no maximo {maximo} caracteres.")

    return texto


def _lista(valor, campo, limites):
    if not isinstance(valor, list):
        raise ErroDeValidacao(f"O campo {campo} precisa ser uma lista.")

    minimo, maximo = limites
    if len(valor) < minimo:
        raise ErroDeValidacao(f"Inclua ao menos {minimo} item(ns) em {campo}.")
    if len(valor) > maximo:
        raise ErroDeValidacao(f"O campo {campo} aceita no maximo {maximo} itens.")

    return valor


def _normalizar_secoes(valor):
    secoes = _lista(valor, "conteudo teorico", LIMITES["secoes"])
    resultado = []

    for indice, secao in enumerate(secoes, start=1):
        if not isinstance(secao, dict):
            raise ErroDeValidacao(f"O bloco de leitura {indice} esta em formato invalido.")
        item = {
            "title": _texto(secao.get("title"), f"titulo do bloco de leitura {indice}", 3, 120),
            "text": _texto(secao.get("text"), f"texto do bloco de leitura {indice}", 10, 1200),
        }

        imagem = str(secao.get("image") or "").strip()
        if imagem:
            if not armazenamento.eh_imagem_da_trilha(imagem):
                raise ErroDeValidacao(
                    f"A imagem do bloco de leitura {indice} precisa ser enviada pelo botao Anexar imagem."
                )
            item["image"] = imagem
            item["image_alt"] = _texto(
                secao.get("image_alt"), f"legenda da imagem do bloco {indice}", 0, 160, obrigatorio=False
            )

        resultado.append(item)

    return resultado


def _normalizar_quiz(valor):
    perguntas = _lista(valor, "quiz", LIMITES["quiz"])
    resultado = []

    for indice, pergunta in enumerate(perguntas, start=1):
        if not isinstance(pergunta, dict):
            raise ErroDeValidacao(f"A pergunta {indice} esta em formato invalido.")

        opcoes_brutas = _lista(pergunta.get("options"), f"alternativas da pergunta {indice}", LIMITES["opcoes"])
        opcoes = [
            _texto(opcao, f"alternativa {posicao} da pergunta {indice}", 1, 220)
            for posicao, opcao in enumerate(opcoes_brutas, start=1)
        ]

        try:
            resposta = int(pergunta.get("answer"))
        except (TypeError, ValueError):
            raise ErroDeValidacao(f"Marque a alternativa correta da pergunta {indice}.")

        if not 0 <= resposta < len(opcoes):
            raise ErroDeValidacao(f"A alternativa correta da pergunta {indice} nao existe.")

        resultado.append({
            "question": _texto(pergunta.get("question"), f"enunciado da pergunta {indice}", 5, 320),
            "options": opcoes,
            "answer": resposta,
            "justification": _texto(
                pergunta.get("justification"),
                f"explicacao da pergunta {indice}",
                0,
                400,
                obrigatorio=False,
            ),
        })

    return resultado


def _normalizar_pares(valor, chaves, rotulos):
    pares = _lista(valor, "pares do minijogo", LIMITES["pares"])
    resultado = []

    for indice, par in enumerate(pares, start=1):
        if not isinstance(par, dict):
            raise ErroDeValidacao(f"O par {indice} do minijogo esta em formato invalido.")

        item = {"id": _texto(par.get("id"), "id do par", 0, 24, obrigatorio=False) or f"p{indice}"}
        for chave, rotulo in zip(chaves, rotulos):
            item[chave] = _texto(par.get(chave), f"{rotulo} do par {indice}", 1, 220)
        resultado.append(item)

    return resultado


def _normalizar_palavras(valor, rotulo):
    palavras_brutas = _lista(valor, rotulo, LIMITES["palavras"])
    palavras = []

    for palavra in palavras_brutas:
        limpa = re.sub(r"[^A-Z]", "", str(palavra or "").upper())
        if not 3 <= len(limpa) <= 10:
            raise ErroDeValidacao(
                f"Em {rotulo}, use palavras de 3 a 10 letras e sem acentos (problema em: {palavra})."
            )
        if limpa in palavras:
            raise ErroDeValidacao(f"A palavra {limpa} esta repetida em {rotulo}.")
        palavras.append(limpa)

    return palavras


def _numero(valor, campo, minimo, maximo, padrao):
    if valor in (None, ""):
        return padrao
    try:
        numero = int(valor)
    except (TypeError, ValueError):
        raise ErroDeValidacao(f"O campo {campo} precisa ser um numero.")
    if not minimo <= numero <= maximo:
        raise ErroDeValidacao(f"O campo {campo} precisa ficar entre {minimo} e {maximo}.")
    return numero


def _normalizar_minijogo(valor):
    if not isinstance(valor, dict):
        valor = {}

    tipo = str(valor.get("type") or "nenhum").strip()
    if tipo not in TIPOS_MINIJOGO:
        raise ErroDeValidacao("Escolha um tipo de minijogo valido.")

    if tipo == "nenhum":
        return {"type": "nenhum"}

    minijogo = {
        "type": tipo,
        "title": _texto(valor.get("title"), "titulo do minijogo", 0, 120, obrigatorio=False)
        or ROTULOS_MINIJOGO[tipo],
        "instruction": _texto(valor.get("instruction"), "instrucao do minijogo", 0, 320, obrigatorio=False)
        or "Complete o desafio para liberar a conclusao da etapa.",
    }

    if tipo == "memory":
        minijogo["pairs"] = _normalizar_pares(
            valor.get("pairs"), ("term", "match"), ("termo", "significado")
        )
        minijogo["target_points"] = len(minijogo["pairs"]) * 10

    elif tipo == "drag_drop":
        minijogo["pairs"] = _normalizar_pares(
            valor.get("pairs"), ("left", "right"), ("bloco", "explicacao")
        )

    elif tipo == "word_search":
        variacoes_brutas = _lista(valor.get("variations"), "grupos de palavras", LIMITES["variacoes"])
        variacoes = []
        for indice, variacao in enumerate(variacoes_brutas, start=1):
            if not isinstance(variacao, dict):
                raise ErroDeValidacao(f"O grupo de palavras {indice} esta em formato invalido.")
            variacoes.append({
                "theme": _texto(variacao.get("theme"), f"tema do grupo {indice}", 2, 80),
                "words": _normalizar_palavras(variacao.get("words"), f"palavras do grupo {indice}"),
            })
        minijogo["variations"] = variacoes
        minijogo["target_points"] = max(len(item["words"]) for item in variacoes) * 10

    elif tipo == "snake":
        minijogo["target_score"] = _numero(valor.get("target_score"), "meta de bolinhas", 5, 60, 20)

    elif tipo == "maze":
        minijogo["total_levels"] = _numero(valor.get("total_levels"), "numero de fases", 1, 3, 3)

    return minijogo


def normalizar_atividade(payload, atividade_id):
    """Valida o que veio do painel do professor e devolve a atividade pronta."""
    if not isinstance(payload, dict):
        raise ErroDeValidacao("Envie os dados da atividade.")

    titulo = _texto(payload.get("title"), "titulo da etapa", 3, 120)
    periodo = _texto(payload.get("period"), "periodo", 2, 60)
    descricao = _texto(payload.get("description"), "descricao", 10, 320)

    cor = str(payload.get("color") or "blue").strip()
    if cor not in CORES_DISPONIVEIS:
        cor = "blue"

    return {
        "id": int(atividade_id),
        "period": periodo,
        "title": titulo,
        "description": descricao,
        "color": cor,
        "eyebrow": _texto(payload.get("eyebrow"), "chamada da aula", 0, 120, obrigatorio=False) or periodo,
        "lesson_title": _texto(payload.get("lesson_title"), "titulo da aula", 0, 160, obrigatorio=False) or titulo,
        "intro": _texto(payload.get("intro"), "introducao da aula", 0, 600, obrigatorio=False) or descricao,
        "sections": _normalizar_secoes(payload.get("sections")),
        "quiz": _normalizar_quiz(payload.get("quiz")),
        "minigame": _normalizar_minijogo(payload.get("minigame")),
    }


# ---------------------------------------------------------------------------
# Operacoes de escrita (CRUD)
# ---------------------------------------------------------------------------

def _trilha_para_escrita(cursor, professor_id):
    """Trava a trilha do professor e garante uma copia propria antes de editar."""
    cursor.execute("select id from public.usuarios where id = %s for update", (int(professor_id),))
    return _carregar(cursor, professor_id) or atividades_padrao()


def _indice_da_atividade(atividades, atividade_id):
    try:
        alvo = int(atividade_id)
    except (TypeError, ValueError):
        raise ErroDeValidacao("Atividade nao encontrada.")

    indice = next((i for i, item in enumerate(atividades) if int(item["id"]) == alvo), None)
    if indice is None:
        raise ErroDeValidacao("Atividade nao encontrada.")
    return indice


def criar_atividade(professor_id, payload, posicao=None):
    with db.transacao() as cursor:
        atividades = _trilha_para_escrita(cursor, professor_id)

        cursor.execute("select nextval('public.trilha_atividades_id_seq') as id")
        atividade = normalizar_atividade(payload, cursor.fetchone()["id"])

        if posicao is None or not isinstance(posicao, int) or posicao < 0 or posicao > len(atividades):
            atividades.append(atividade)
        else:
            atividades.insert(posicao, atividade)

        _gravar(cursor, professor_id, atividades)
        return copy.deepcopy(atividade)


def atualizar_atividade(professor_id, atividade_id, payload):
    with db.transacao() as cursor:
        atividades = _trilha_para_escrita(cursor, professor_id)
        indice = _indice_da_atividade(atividades, atividade_id)
        antiga = atividades[indice]

        atividades[indice] = normalizar_atividade(payload, antiga["id"])
        _gravar(cursor, professor_id, atividades)

    armazenamento.remover_imagens(_imagens([antiga]) - _imagens([atividades[indice]]))
    return copy.deepcopy(atividades[indice])


def remover_atividade(professor_id, atividade_id):
    with db.transacao() as cursor:
        atividades = _trilha_para_escrita(cursor, professor_id)
        indice = _indice_da_atividade(atividades, atividade_id)

        if len(atividades) <= 1:
            raise ErroDeValidacao("A trilha precisa ter pelo menos uma atividade.")

        removida = atividades.pop(indice)
        _gravar(cursor, professor_id, atividades)

    armazenamento.remover_imagens(_imagens([removida]))
    return copy.deepcopy(removida)


def reordenar_atividades(professor_id, ids):
    with db.transacao() as cursor:
        atividades = _trilha_para_escrita(cursor, professor_id)

        if not isinstance(ids, list):
            raise ErroDeValidacao("Envie a nova ordem das atividades.")

        try:
            ordem = [int(item) for item in ids]
        except (TypeError, ValueError):
            raise ErroDeValidacao("A nova ordem possui ids invalidos.")

        if sorted(ordem) != sorted(ids_das_atividades(atividades)):
            raise ErroDeValidacao("A nova ordem precisa conter exatamente as atividades atuais.")

        por_id = {int(item["id"]): item for item in atividades}
        atividades = [por_id[item] for item in ordem]

        _gravar(cursor, professor_id, atividades)
        return copy.deepcopy(atividades)


def restaurar_padrao(professor_id):
    with db.transacao() as cursor:
        personalizada = _carregar(cursor, professor_id)
        cursor.execute("delete from public.trilha_atividades where professor_id = %s", (int(professor_id),))

    armazenamento.remover_imagens(_imagens(personalizada))
    return atividades_padrao()
