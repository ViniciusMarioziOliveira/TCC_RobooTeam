# -*- coding: utf-8 -*-
"""Persistencia e validacao das atividades da trilha.

A trilha padrao vive em ``trilha_conteudo.ATIVIDADES_PADRAO``. Quando um
professor edita a trilha, uma copia personalizada dela e gravada em
``trilha_atividades.json`` sob o id daquele professor. Os alunos que estao na
sala desse professor passam a ver a trilha personalizada; quem ainda nao entrou
em nenhuma sala continua vendo a trilha padrao.

Formato do arquivo::

    {
      "proximo_id": 6,
      "professores": {
        "2001": [ {atividade}, {atividade}, ... ]
      }
    }
"""

import copy
import json
import re
import threading
from pathlib import Path

from trilha_conteudo import (
    ATIVIDADES_PADRAO,
    CORES_DISPONIVEIS,
    ROTULOS_MINIJOGO,
    TIPOS_MINIJOGO,
)

ARQUIVO_TRILHA = Path(__file__).resolve().parent / "trilha_atividades.json"

_LOCK = threading.Lock()

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
# Leitura e gravacao do arquivo
# ---------------------------------------------------------------------------

def _estrutura_vazia():
    return {"proximo_id": _maior_id_padrao() + 1, "professores": {}}


def _maior_id_padrao():
    return max((int(item["id"]) for item in ATIVIDADES_PADRAO), default=0)


def _ler():
    if not ARQUIVO_TRILHA.exists():
        return _estrutura_vazia()

    try:
        dados = json.loads(ARQUIVO_TRILHA.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return _estrutura_vazia()

    if not isinstance(dados, dict):
        return _estrutura_vazia()

    professores = dados.get("professores")
    if not isinstance(professores, dict):
        professores = {}

    try:
        proximo_id = int(dados.get("proximo_id"))
    except (TypeError, ValueError):
        proximo_id = _maior_id_padrao() + 1

    return {
        "proximo_id": max(proximo_id, _maior_id_padrao() + 1),
        "professores": {
            str(chave): valor
            for chave, valor in professores.items()
            if isinstance(valor, list)
        },
    }


def _gravar(dados):
    temporario = ARQUIVO_TRILHA.with_suffix(".tmp")
    temporario.write_text(
        json.dumps(dados, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    temporario.replace(ARQUIVO_TRILHA)


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

    dados = _ler()
    personalizada = dados["professores"].get(str(professor_id))
    if not personalizada:
        return atividades_padrao()

    return copy.deepcopy(personalizada)


def usa_trilha_personalizada(professor_id):
    if professor_id is None:
        return False
    return str(professor_id) in _ler()["professores"]


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
        resultado.append({
            "title": _texto(secao.get("title"), f"titulo do bloco de leitura {indice}", 3, 120),
            "text": _texto(secao.get("text"), f"texto do bloco de leitura {indice}", 10, 1200),
        })

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

def _trilha_para_escrita(dados, professor_id):
    """Garante que o professor tenha uma copia propria antes de editar."""
    chave = str(professor_id)
    if chave not in dados["professores"]:
        dados["professores"][chave] = atividades_padrao()
    return dados["professores"][chave]


def criar_atividade(professor_id, payload, posicao=None):
    with _LOCK:
        dados = _ler()
        atividades = _trilha_para_escrita(dados, professor_id)

        novo_id = dados["proximo_id"]
        atividade = normalizar_atividade(payload, novo_id)
        dados["proximo_id"] = novo_id + 1

        if posicao is None or not isinstance(posicao, int) or posicao < 0 or posicao > len(atividades):
            atividades.append(atividade)
        else:
            atividades.insert(posicao, atividade)

        _gravar(dados)
        return copy.deepcopy(atividade)


def atualizar_atividade(professor_id, atividade_id, payload):
    with _LOCK:
        dados = _ler()
        atividades = _trilha_para_escrita(dados, professor_id)

        try:
            alvo = int(atividade_id)
        except (TypeError, ValueError):
            raise ErroDeValidacao("Atividade nao encontrada.")

        indice = next((i for i, item in enumerate(atividades) if int(item["id"]) == alvo), None)
        if indice is None:
            raise ErroDeValidacao("Atividade nao encontrada.")

        atividades[indice] = normalizar_atividade(payload, alvo)
        _gravar(dados)
        return copy.deepcopy(atividades[indice])


def remover_atividade(professor_id, atividade_id):
    with _LOCK:
        dados = _ler()
        atividades = _trilha_para_escrita(dados, professor_id)

        try:
            alvo = int(atividade_id)
        except (TypeError, ValueError):
            raise ErroDeValidacao("Atividade nao encontrada.")

        if len(atividades) <= 1:
            raise ErroDeValidacao("A trilha precisa ter pelo menos uma atividade.")

        indice = next((i for i, item in enumerate(atividades) if int(item["id"]) == alvo), None)
        if indice is None:
            raise ErroDeValidacao("Atividade nao encontrada.")

        removida = atividades.pop(indice)
        _gravar(dados)
        return copy.deepcopy(removida)


def reordenar_atividades(professor_id, ids):
    with _LOCK:
        dados = _ler()
        atividades = _trilha_para_escrita(dados, professor_id)

        if not isinstance(ids, list):
            raise ErroDeValidacao("Envie a nova ordem das atividades.")

        try:
            ordem = [int(item) for item in ids]
        except (TypeError, ValueError):
            raise ErroDeValidacao("A nova ordem possui ids invalidos.")

        if sorted(ordem) != sorted(ids_das_atividades(atividades)):
            raise ErroDeValidacao("A nova ordem precisa conter exatamente as atividades atuais.")

        por_id = {int(item["id"]): item for item in atividades}
        dados["professores"][str(professor_id)] = [por_id[item] for item in ordem]

        _gravar(dados)
        return copy.deepcopy(dados["professores"][str(professor_id)])


def restaurar_padrao(professor_id):
    with _LOCK:
        dados = _ler()
        dados["professores"].pop(str(professor_id), None)
        _gravar(dados)
        return atividades_padrao()
