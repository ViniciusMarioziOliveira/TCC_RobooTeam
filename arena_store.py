# -*- coding: utf-8 -*-
"""Arena RobooTeam: partidas em sala criadas pelo professor.

O professor desenha (ou sorteia) um mapa, recebe um codigo ``ARN-XXXX`` e os
alunos da turma dele (so quem ja entrou com o codigo RBT) usam esse codigo no
campo "Codigo da Arena" do painel. Cada aluno escolhe uma equipe (ate 4
jogadores), programa o robo com blocos (avancar, virar e repetir) e o tempo de
cada um e somado no ranking da equipe.

Os dados ficam no Supabase, nas tabelas ``arenas``, ``arena_equipes`` e
``arena_jogadores``. Ao carregar, cada arena vira um dicionario::

    {
      "id": 1, "professor_id": 1, "codigo": "ARN-7K3P",
      "nome": "...", "tamanho": 8, "mapa": "LLOL...", "direcao": "E",
      "limite_blocos": 0, "status": "aguardando" | "em_jogo" | "finalizada",
      "equipes": {"foguetes": {"nome": "Foguetes", "cor": "cyan", "icone": "rocket"}},
      "jogadores": {"1001": {...}}
    }

O icone da equipe e o nome de um icone do site (sprite em ``templates/_icones.html``)
e fica gravado na coluna ``arena_equipes.emoji``.

As operacoes que alteram uma arena travam a linha dela (``for update``) ate o
fim da transacao, entao dois alunos jogando ao mesmo tempo nunca sobrescrevem
o resultado um do outro.
"""

import random
import secrets
from collections import deque
from datetime import datetime, timezone

from psycopg.types.json import Jsonb

import db

TAMANHOS = (6, 8, 10)
DIRECOES = ("N", "E", "S", "W")
DESLOCAMENTOS = {"N": (-1, 0), "E": (0, 1), "S": (1, 0), "W": (0, -1)}
COMANDOS_SIMPLES = ("avancar", "virar_esquerda", "virar_direita")
STATUS = ("aguardando", "em_jogo", "finalizada")

MAX_EQUIPES = 12
MAX_JOGADORES_EQUIPE = 4
MAX_BLOCOS = 40
MAX_REPETICOES = 10
MAX_PASSOS = 400
SEGUNDOS_ONLINE = 15
# tempo de chamada de um pedido de ajuda; depois dele a equipe pode chamar o professor
SEGUNDOS_AJUDA = 30

CORES_EQUIPE = ("cyan", "purple", "pink", "orange", "green", "yellow")
ICONES_EQUIPE = (
    "rocket", "zap", "star", "turtle", "fish", "cat",
    "bug", "rainbow", "flame", "clover", "target", "satellite",
)
# equipes criadas antes dos icones guardaram um emoji na coluna "emoji"
ICONE_DO_EMOJI_ANTIGO = {
    "\U0001F680": "rocket", "\u26A1": "zap", "\U0001F31F": "star", "\U0001F996": "turtle",
    "\U0001F419": "fish", "\U0001F98A": "cat", "\U0001F41D": "bug", "\U0001F308": "rainbow",
    "\U0001F525": "flame", "\U0001F340": "clover", "\U0001F3AF": "target", "\U0001F6F8": "satellite",
}
MOTIVOS_AJUDA = {
    "comecar": "Não sei por onde começar",
    "parede": "Meu robô bate na parede",
    "repetir": "Não entendi o bloco Repetir",
    "outro": "Tenho outra dúvida",
}
# usado quando a equipe tentou ajudar, nao conseguiu e chamou o professor
MOTIVO_EQUIPE_TODA = "equipe_toda"
TEXTO_EQUIPE_TODA = "A equipe toda está com dúvida"
ALFABETO_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


class ErroArena(ValueError):
    """Erro com mensagem pronta para a interface e status HTTP sugerido."""

    def __init__(self, mensagem, status=400):
        super().__init__(mensagem)
        self.status = status


# ---------------------------------------------------------------------------
# Utilitarios
# ---------------------------------------------------------------------------

def agora():
    return datetime.now(timezone.utc)


def agora_iso():
    return agora().isoformat()


def _data(valor):
    if not valor:
        return None
    try:
        data = datetime.fromisoformat(str(valor).replace("Z", "+00:00"))
    except ValueError:
        return None
    return data if data.tzinfo else data.replace(tzinfo=timezone.utc)


def _segundos_entre(inicio, fim):
    inicio, fim = _data(inicio), _data(fim)
    if not inicio or not fim:
        return None
    return max(0, round((fim - inicio).total_seconds()))


def _chave_equipe(nome):
    return " ".join(str(nome).split()).lower()


def icone_da_equipe(valor):
    """Nome do icone da equipe (converte os emojis gravados antes da troca)."""
    valor = str(valor or "").replace("️", "").strip()
    valor = ICONE_DO_EMOJI_ANTIGO.get(valor, valor)
    return valor if valor in ICONES_EQUIPE else ICONES_EQUIPE[0]


# ---------------------------------------------------------------------------
# Leitura e gravacao no banco
# ---------------------------------------------------------------------------

_COLUNAS_JOGADOR = (
    "nome", "equipe", "entrou_em", "tentativas", "dicas", "concluiu", "concluiu_em",
    "tempo", "blocos", "estrelas", "ajuda", "ajudas_recebidas", "ultimo_erro",
)


def _texto_iso(linha):
    """Datas do banco viram texto ISO, como o resto do codigo espera."""
    return {
        chave: valor.astimezone(timezone.utc).isoformat() if isinstance(valor, datetime) else valor
        for chave, valor in linha.items()
    }


def _carregar_salas(cursor, filtro, parametros, bloquear=False):
    """Arenas que atendem ao filtro, ja com equipes e jogadores (3 consultas)."""
    cursor.execute(
        f"""
        select id, professor_id, professor_nome, codigo, nome, tamanho, mapa, direcao,
               limite_blocos, status, criada_em, iniciada_em, finalizada_em
          from public.arenas
         where {filtro}
        {"for update" if bloquear else ""}
        """,
        parametros,
    )
    salas = [dict(_texto_iso(linha), equipes={}, jogadores={}) for linha in cursor.fetchall()]
    if not salas:
        return []

    por_id = {sala["id"]: sala for sala in salas}

    cursor.execute(
        """
        select arena_id, chave, nome, cor, emoji
          from public.arena_equipes
         where arena_id = any(%s)
         order by criada_em, chave
        """,
        (list(por_id),),
    )
    for linha in cursor.fetchall():
        por_id[linha["arena_id"]]["equipes"][linha["chave"]] = {
            "nome": linha["nome"], "cor": linha["cor"], "icone": icone_da_equipe(linha["emoji"]),
        }

    cursor.execute(
        f"""
        select arena_id, aluno_id as id, visto_em, {", ".join(_COLUNAS_JOGADOR)}
          from public.arena_jogadores
         where arena_id = any(%s)
         order by entrou_em, aluno_id
        """,
        (list(por_id),),
    )
    for linha in cursor.fetchall():
        jogador = _texto_iso(linha)
        por_id[jogador.pop("arena_id")]["jogadores"][str(jogador["id"])] = jogador
    return salas


def _carregar_sala(cursor, filtro, parametros, bloquear=False):
    salas = _carregar_salas(cursor, filtro, parametros, bloquear)
    return salas[0] if salas else None


def _salvar_sala(cursor, sala):
    cursor.execute(
        """
        update public.arenas
           set nome = %s, tamanho = %s, mapa = %s, direcao = %s, limite_blocos = %s,
               status = %s, iniciada_em = %s, finalizada_em = %s
         where id = %s
        """,
        (
            sala["nome"], sala["tamanho"], sala["mapa"], sala["direcao"],
            sala.get("limite_blocos") or 0, sala["status"],
            _data(sala.get("iniciada_em")), _data(sala.get("finalizada_em")), sala["id"],
        ),
    )


def _salvar_equipe(cursor, sala, chave):
    equipe = sala["equipes"][chave]
    cursor.execute(
        """
        insert into public.arena_equipes (arena_id, chave, nome, cor, emoji)
        values (%s, %s, %s, %s, %s)
        on conflict (arena_id, chave) do nothing
        """,
        (sala["id"], chave, equipe["nome"], equipe["cor"], equipe["icone"]),
    )


def _valor_do_jogador(jogador, coluna):
    valor = jogador.get(coluna)
    if coluna in ("entrou_em", "concluiu_em"):
        return _data(valor)
    if coluna == "ajuda":
        return Jsonb(valor) if valor else None
    if coluna in ("tentativas", "dicas", "ajudas_recebidas"):
        return int(valor or 0)
    if coluna == "concluiu":
        return bool(valor)
    return valor


def _salvar_jogadores(cursor, sala, ids=None):
    """Grava os jogadores indicados (ou todos os da arena)."""
    jogadores = sala.get("jogadores", {})
    escolhidos = [jogadores[str(i)] for i in ids] if ids is not None else list(jogadores.values())
    if not escolhidos:
        return

    colunas = ", ".join(_COLUNAS_JOGADOR)
    marcadores = ", ".join(["%s"] * (len(_COLUNAS_JOGADOR) + 2))
    atualizacao = ", ".join(f"{coluna} = excluded.{coluna}" for coluna in _COLUNAS_JOGADOR)
    cursor.executemany(
        f"""
        insert into public.arena_jogadores (arena_id, aluno_id, {colunas})
        values ({marcadores})
        on conflict (arena_id, aluno_id) do update set {atualizacao}
        """,
        [
            (sala["id"], int(jogador["id"]), *(_valor_do_jogador(jogador, c) for c in _COLUNAS_JOGADOR))
            for jogador in escolhidos
        ],
    )


# ---------------------------------------------------------------------------
# Mapa: validacao, caminho minimo e sorteio
# ---------------------------------------------------------------------------

def validar_mapa(tamanho, mapa):
    try:
        tamanho = int(tamanho)
    except (TypeError, ValueError):
        raise ErroArena("Tamanho de mapa inválido")
    if tamanho not in TAMANHOS:
        raise ErroArena("Escolha um mapa de 6, 8 ou 10 casas")

    mapa = str(mapa or "").upper()
    if len(mapa) != tamanho * tamanho or any(celula not in "LOIF" for celula in mapa):
        raise ErroArena("O mapa enviado está incompleto")
    if mapa.count("I") != 1:
        raise ErroArena("Coloque exatamente um ponto de início do robô")
    if mapa.count("F") != 1:
        raise ErroArena("Coloque exatamente uma bandeira de chegada")
    return tamanho, mapa


def solucao_minima(tamanho, mapa, direcao):
    """Menor sequencia de comandos simples (BFS em posicao + direcao)."""
    inicio = mapa.index("I")
    fim = mapa.index("F")
    estado_inicial = (inicio // tamanho, inicio % tamanho, direcao)
    anteriores = {estado_inicial: None}
    fila = deque([estado_inicial])

    while fila:
        linha, coluna, orientacao = estado = fila.popleft()
        if linha * tamanho + coluna == fim:
            comandos = []
            while anteriores[estado]:
                estado, comando = anteriores[estado]
                comandos.append(comando)
            return list(reversed(comandos))

        indice = DIRECOES.index(orientacao)
        vizinhos = [
            ((linha, coluna, DIRECOES[(indice - 1) % 4]), "virar_esquerda"),
            ((linha, coluna, DIRECOES[(indice + 1) % 4]), "virar_direita"),
        ]
        dl, dc = DESLOCAMENTOS[orientacao]
        nl, nc = linha + dl, coluna + dc
        if 0 <= nl < tamanho and 0 <= nc < tamanho and mapa[nl * tamanho + nc] != "O":
            vizinhos.append(((nl, nc, orientacao), "avancar"))

        for proximo, comando in vizinhos:
            if proximo not in anteriores:
                anteriores[proximo] = (estado, comando)
                fila.append(proximo)
    return None


def caminho_das_celulas(tamanho, mapa, direcao, comandos):
    """Casas percorridas por uma sequencia de comandos (usado nas dicas)."""
    inicio = mapa.index("I")
    linha, coluna, orientacao = inicio // tamanho, inicio % tamanho, direcao
    casas = []
    for comando in comandos:
        if comando == "avancar":
            dl, dc = DESLOCAMENTOS[orientacao]
            linha, coluna = linha + dl, coluna + dc
            casas.append({"linha": linha, "coluna": coluna})
        elif comando == "virar_esquerda":
            orientacao = DIRECOES[(DIRECOES.index(orientacao) - 1) % 4]
        else:
            orientacao = DIRECOES[(DIRECOES.index(orientacao) + 1) % 4]
    return casas


def gerar_mapa_aleatorio(tamanho=8):
    """Sorteia um mapa com caminho garantido entre o inicio e a bandeira."""
    tamanho = int(tamanho) if int(tamanho) in TAMANHOS else 8
    for _ in range(60):
        grade = ["O"] * (tamanho * tamanho)
        linha, coluna = random.randrange(tamanho), random.choice((0, 1))
        grade[linha * tamanho + coluna] = "I"
        destino_linha, destino_coluna = random.randrange(tamanho), random.choice((tamanho - 2, tamanho - 1))

        # caminho "bebado" ate a bandeira, com tendencia a seguir para ela
        passos = 0
        while (linha, coluna) != (destino_linha, destino_coluna) and passos < tamanho * tamanho * 4:
            passos += 1
            opcoes = []
            if coluna < destino_coluna:
                opcoes += [(0, 1)] * 3
            if linha < destino_linha:
                opcoes += [(1, 0)] * 2
            if linha > destino_linha:
                opcoes += [(-1, 0)] * 2
            opcoes += [(1, 0), (-1, 0), (0, 1)]
            dl, dc = random.choice(opcoes)
            nl, nc = linha + dl, coluna + dc
            if 0 <= nl < tamanho and 0 <= nc < tamanho:
                linha, coluna = nl, nc
                if grade[linha * tamanho + coluna] == "O":
                    grade[linha * tamanho + coluna] = "L"
        grade[destino_linha * tamanho + destino_coluna] = "F"

        # abre mais espacos para o mapa nao virar um corredor unico
        for indice, celula in enumerate(grade):
            if celula == "O" and random.random() < 0.45:
                grade[indice] = "L"

        mapa = "".join(grade)
        direcao = random.choice(("E", "N", "S"))
        solucao = solucao_minima(tamanho, mapa, direcao)
        if solucao and len(solucao) >= tamanho:
            return {"tamanho": tamanho, "mapa": mapa, "direcao": direcao}

    # sem sorte no sorteio: linha reta simples
    grade = ["L"] * (tamanho * tamanho)
    grade[0] = "I"
    grade[tamanho - 1] = "F"
    return {"tamanho": tamanho, "mapa": "".join(grade), "direcao": "E"}


def resumo_do_mapa(tamanho, mapa, direcao):
    solucao = solucao_minima(tamanho, mapa, direcao)
    return {
        "possivel": solucao is not None,
        "minimo_comandos": len(solucao) if solucao else None,
    }


# ---------------------------------------------------------------------------
# Programa do aluno: validacao, expansao e simulacao
# ---------------------------------------------------------------------------

def expandir_programa(programa):
    """Valida a lista de blocos e devolve (comandos_simples, total_de_blocos)."""
    if not isinstance(programa, list) or not programa:
        raise ErroArena("Monte seu programa antes de executar")

    comandos = []
    total_blocos = 0
    for bloco in programa:
        if not isinstance(bloco, dict):
            raise ErroArena("Bloco inválido no programa")
        tipo = bloco.get("tipo")
        total_blocos += 1
        if tipo in COMANDOS_SIMPLES:
            comandos.append(tipo)
        elif tipo == "repetir":
            try:
                vezes = int(bloco.get("vezes"))
            except (TypeError, ValueError):
                raise ErroArena("Escolha quantas vezes o bloco Repetir deve rodar")
            if not 1 <= vezes <= MAX_REPETICOES:
                raise ErroArena(f"O bloco Repetir aceita de 1 a {MAX_REPETICOES} vezes")
            internos = bloco.get("comandos")
            if not isinstance(internos, list):
                raise ErroArena("Bloco Repetir inválido")
            corpo = []
            for interno in internos:
                if not isinstance(interno, dict) or interno.get("tipo") not in COMANDOS_SIMPLES:
                    raise ErroArena("Dentro do Repetir só cabem blocos de andar e virar")
                corpo.append(interno["tipo"])
                total_blocos += 1
            comandos.extend(corpo * vezes)
        else:
            raise ErroArena("Bloco desconhecido no programa")

        if total_blocos > MAX_BLOCOS:
            raise ErroArena(f"Use no máximo {MAX_BLOCOS} blocos")
        if len(comandos) > MAX_PASSOS:
            raise ErroArena("O programa ficou comprido demais")

    if not comandos:
        raise ErroArena("Coloque blocos dentro do Repetir")
    return comandos, total_blocos


def simular(sala, comandos):
    tamanho, mapa = sala["tamanho"], sala["mapa"]
    inicio = mapa.index("I")
    linha, coluna, orientacao = inicio // tamanho, inicio % tamanho, sala["direcao"]

    for indice, comando in enumerate(comandos):
        if comando == "virar_esquerda":
            orientacao = DIRECOES[(DIRECOES.index(orientacao) - 1) % 4]
        elif comando == "virar_direita":
            orientacao = DIRECOES[(DIRECOES.index(orientacao) + 1) % 4]
        else:
            dl, dc = DESLOCAMENTOS[orientacao]
            nl, nc = linha + dl, coluna + dc
            if not (0 <= nl < tamanho and 0 <= nc < tamanho):
                return {"sucesso": False, "motivo": "fora_do_mapa", "passo": indice}
            if mapa[nl * tamanho + nc] == "O":
                return {"sucesso": False, "motivo": "parede", "passo": indice}
            linha, coluna = nl, nc
            if mapa[linha * tamanho + coluna] == "F":
                return {"sucesso": True, "motivo": "bandeira", "passo": indice}

    return {"sucesso": False, "motivo": "nao_chegou", "passo": len(comandos) - 1}


def calcular_estrelas(tentativas, dicas):
    if dicas == 0 and tentativas <= 2:
        return 3
    if dicas <= 1 and tentativas <= 5:
        return 2
    return 1


# ---------------------------------------------------------------------------
# Serializacao
# ---------------------------------------------------------------------------

def _inicio_do_jogador(sala, jogador):
    """O cronometro de cada aluno comeca quando a partida inicia (ou quando ele entra depois)."""
    iniciada, entrou = _data(sala.get("iniciada_em")), _data(jogador.get("entrou_em"))
    if not iniciada:
        return None
    return max(iniciada, entrou).isoformat() if entrou else iniciada.isoformat()


def _online(jogador):
    visto = _data(jogador.get("visto_em"))
    return bool(visto and (agora() - visto).total_seconds() <= SEGUNDOS_ONLINE)


def _jogador_publico(sala, jogador, detalhado=False):
    ajuda = jogador.get("ajuda")
    dados = {
        "id": jogador["id"],
        "nome": jogador["nome"],
        "equipe": jogador["equipe"],
        "concluiu": bool(jogador.get("concluiu")),
        "tempo": jogador.get("tempo"),
        "blocos": jogador.get("blocos"),
        "estrelas": jogador.get("estrelas"),
        "ajuda": dict(ajuda) if ajuda else None,
        "online": _online(jogador),
    }
    if detalhado:
        dados.update({
            "tentativas": jogador.get("tentativas", 0),
            "dicas": jogador.get("dicas", 0),
            "ajudas_recebidas": jogador.get("ajudas_recebidas", 0),
            "entrou_em": jogador.get("entrou_em"),
            "ultimo_erro": jogador.get("ultimo_erro"),
        })
    return dados


def ranking(sala):
    equipes = []
    for chave, equipe in sala.get("equipes", {}).items():
        membros = [j for j in sala.get("jogadores", {}).values() if j.get("equipe") == chave]
        if not membros:
            continue
        concluidos = [j for j in membros if j.get("concluiu")]
        equipes.append({
            "chave": chave,
            "nome": equipe["nome"],
            "cor": equipe.get("cor", "cyan"),
            "icone": equipe.get("icone", ICONES_EQUIPE[0]),
            "jogadores": len(membros),
            "concluidos": len(concluidos),
            "tempo_total": sum(int(j.get("tempo") or 0) for j in concluidos),
            "estrelas": sum(int(j.get("estrelas") or 0) for j in concluidos),
        })
    equipes.sort(key=lambda item: (-item["concluidos"], item["tempo_total"], item["nome"].lower()))
    for posicao, item in enumerate(equipes, start=1):
        item["posicao"] = posicao
    return equipes


def _fila_professor(sala):
    pedidos = [
        j for j in sala.get("jogadores", {}).values()
        if j.get("ajuda") and j["ajuda"].get("tipo") == "professor"
    ]
    pedidos.sort(key=lambda j: j["ajuda"].get("pedida_em", ""))
    return pedidos


def _sala_publica(sala):
    return {
        "id": sala["id"],
        "codigo": sala["codigo"],
        "nome": sala["nome"],
        "professor_nome": sala.get("professor_nome", ""),
        "tamanho": sala["tamanho"],
        "mapa": sala["mapa"],
        "direcao": sala["direcao"],
        "limite_blocos": sala.get("limite_blocos", 0),
        "status": sala["status"],
        "criada_em": sala.get("criada_em"),
        "iniciada_em": sala.get("iniciada_em"),
        "finalizada_em": sala.get("finalizada_em"),
    }


def visao_professor(sala):
    jogadores = list(sala.get("jogadores", {}).values())
    equipes = []
    for chave, equipe in sala.get("equipes", {}).items():
        membros = [_jogador_publico(sala, j, detalhado=True) for j in jogadores if j.get("equipe") == chave]
        if membros:
            equipes.append({"chave": chave, **equipe, "membros": membros})

    fila = [_jogador_publico(sala, j, detalhado=True) for j in _fila_professor(sala)]
    pedidos_equipe = [
        _jogador_publico(sala, j) for j in jogadores
        if j.get("ajuda") and j["ajuda"].get("tipo") == "equipe"
    ]
    return {
        **_sala_publica(sala),
        "mapa_info": resumo_do_mapa(sala["tamanho"], sala["mapa"], sala["direcao"]),
        "agora": agora_iso(),
        "segundos_ajuda": SEGUNDOS_AJUDA,
        "equipes": equipes,
        "ranking": ranking(sala),
        "pedidos_professor": fila,
        "pedidos_equipe": pedidos_equipe,
        "estatisticas": {
            "jogadores": len(jogadores),
            "equipes": len(equipes),
            "concluiram": sum(1 for j in jogadores if j.get("concluiu")),
            "online": sum(1 for j in jogadores if _online(j)),
            "pedidos": len(fila),
        },
    }


def resumo_professor(sala):
    """Versao curta para a lista de arenas do painel."""
    jogadores = list(sala.get("jogadores", {}).values())
    equipes = sala.get("equipes", {})
    fila = _fila_professor(sala)
    return {
        **_sala_publica(sala),
        "jogadores": len(jogadores),
        "equipes": len({j.get("equipe") for j in jogadores}),
        "concluiram": sum(1 for j in jogadores if j.get("concluiu")),
        "pedidos": len(fila),
        "pedidos_detalhe": [
            {
                "aluno_id": j["id"],
                "nome": j["nome"],
                "equipe": equipes.get(j.get("equipe"), {}).get("nome", ""),
                "pedida_em": j["ajuda"].get("pedida_em"),
                "motivo": j["ajuda"].get("motivo"),
                "motivo_texto": j["ajuda"].get("motivo_texto"),
                "status": j["ajuda"].get("status"),
            }
            for j in fila
        ],
    }


def visao_aluno(sala, aluno_id):
    aluno_id = str(aluno_id)
    jogadores = sala.get("jogadores", {})
    eu = jogadores.get(aluno_id)
    equipes = []
    for chave, equipe in sala.get("equipes", {}).items():
        membros = [j for j in jogadores.values() if j.get("equipe") == chave]
        if not membros:
            continue
        equipes.append({
            "chave": chave,
            "nome": equipe["nome"],
            "cor": equipe.get("cor", "cyan"),
            "icone": equipe.get("icone", ICONES_EQUIPE[0]),
            "membros": [m["nome"].split()[0] for m in membros],
            "lotada": len(membros) >= MAX_JOGADORES_EQUIPE,
        })

    resposta = {
        "sala": _sala_publica(sala),
        "agora": agora_iso(),
        "equipes": equipes,
        "ranking": ranking(sala),
        "motivos_ajuda": MOTIVOS_AJUDA,
        "segundos_ajuda": SEGUNDOS_AJUDA,
        "max_blocos": MAX_BLOCOS,
        "max_repeticoes": MAX_REPETICOES,
        "eu": None,
        "minha_equipe": None,
        "colegas_pedindo_ajuda": [],
    }
    if not eu:
        return resposta

    fila = _fila_professor(sala)
    posicao = next((i for i, j in enumerate(fila, start=1) if str(j["id"]) == aluno_id), None)
    resposta["eu"] = {
        **_jogador_publico(sala, eu, detalhado=True),
        "inicio_em": _inicio_do_jogador(sala, eu),
        "posicao_fila": posicao,
        "nivel_dica": eu.get("dicas", 0),
    }
    equipe = sala.get("equipes", {}).get(eu["equipe"], {})
    membros = [_jogador_publico(sala, j) for j in jogadores.values() if j.get("equipe") == eu["equipe"]]
    resposta["minha_equipe"] = {
        "chave": eu["equipe"],
        "nome": equipe.get("nome", ""),
        "cor": equipe.get("cor", "cyan"),
        "icone": equipe.get("icone", ICONES_EQUIPE[0]),
        "membros": membros,
    }
    resposta["colegas_pedindo_ajuda"] = [
        m for m in membros
        if str(m["id"]) != aluno_id and m["ajuda"] and not m["concluiu"]
    ]
    return resposta


# ---------------------------------------------------------------------------
# Operacoes do professor
# ---------------------------------------------------------------------------

def _gerar_codigo(cursor):
    while True:
        codigo = "ARN-" + "".join(secrets.choice(ALFABETO_CODIGO) for _ in range(4))
        cursor.execute("select 1 from public.arenas where codigo = %s", (codigo,))
        if not cursor.fetchone():
            return codigo


def _normalizar_payload(payload):
    if not isinstance(payload, dict):
        raise ErroArena("Envie os dados da arena")
    nome = " ".join(str(payload.get("nome", "")).split())[:60]
    if len(nome) < 2:
        raise ErroArena("Dê um nome para a arena")
    tamanho, mapa = validar_mapa(payload.get("tamanho"), payload.get("mapa"))
    direcao = str(payload.get("direcao", "E")).upper()
    if direcao not in DIRECOES:
        raise ErroArena("Direção inicial inválida")
    try:
        limite = int(payload.get("limite_blocos") or 0)
    except (TypeError, ValueError):
        raise ErroArena("Limite de blocos inválido")
    if limite and not 3 <= limite <= MAX_BLOCOS:
        raise ErroArena(f"O limite de blocos deve ficar entre 3 e {MAX_BLOCOS} (ou vazio)")
    solucao = solucao_minima(tamanho, mapa, direcao)
    if solucao is None:
        raise ErroArena("Não existe caminho do início até a bandeira. Abra passagem nas paredes!")
    return {"nome": nome, "tamanho": tamanho, "mapa": mapa, "direcao": direcao, "limite_blocos": limite}


def _sala_do_professor(cursor, sala_id, professor_id, bloquear=False):
    try:
        sala_id = int(sala_id)
    except (TypeError, ValueError):
        raise ErroArena("Arena não encontrada", 404)
    sala = _carregar_sala(cursor, "id = %s", (sala_id,), bloquear)
    if not sala or str(sala.get("professor_id")) != str(professor_id):
        raise ErroArena("Arena não encontrada", 404)
    return sala


def listar_do_professor(professor_id):
    with db.transacao() as cursor:
        return _carregar_salas(cursor, "professor_id = %s order by criada_em desc", (int(professor_id),))


def obter_do_professor(sala_id, professor_id):
    with db.transacao() as cursor:
        return _sala_do_professor(cursor, sala_id, professor_id)


def criar_sala(professor, payload):
    dados_sala = _normalizar_payload(payload)
    with db.transacao() as cursor:
        cursor.execute(
            """
            insert into public.arenas
                   (professor_id, professor_nome, codigo, nome, tamanho, mapa, direcao, limite_blocos)
            values (%s, %s, %s, %s, %s, %s, %s, %s)
            returning id
            """,
            (
                int(professor["id"]), professor["nome"], _gerar_codigo(cursor), dados_sala["nome"],
                dados_sala["tamanho"], dados_sala["mapa"], dados_sala["direcao"], dados_sala["limite_blocos"],
            ),
        )
        return _carregar_sala(cursor, "id = %s", (cursor.fetchone()["id"],))


def atualizar_sala(sala_id, professor_id, payload):
    dados_sala = _normalizar_payload(payload)
    with db.transacao() as cursor:
        sala = _sala_do_professor(cursor, sala_id, professor_id, bloquear=True)
        mudou_mapa = any(sala[campo] != dados_sala[campo] for campo in ("tamanho", "mapa", "direcao"))
        if mudou_mapa and sala["status"] == "em_jogo":
            raise ErroArena("Encerre a partida antes de trocar o mapa", 409)
        sala.update(dados_sala)
        if mudou_mapa:
            for jogador in sala["jogadores"].values():
                jogador.update({"concluiu": False, "tempo": None, "blocos": None, "estrelas": None,
                                "tentativas": 0, "dicas": 0, "ultimo_erro": None})
        _salvar_sala(cursor, sala)
        if mudou_mapa:
            _salvar_jogadores(cursor, sala)
        return sala


def remover_sala(sala_id, professor_id):
    with db.transacao() as cursor:
        _sala_do_professor(cursor, sala_id, professor_id, bloquear=True)
        cursor.execute("delete from public.arenas where id = %s", (int(sala_id),))


def alterar_status(sala_id, professor_id, acao):
    with db.transacao() as cursor:
        sala = _sala_do_professor(cursor, sala_id, professor_id, bloquear=True)
        if acao == "iniciar":
            if sala["status"] == "em_jogo":
                raise ErroArena("A partida já está em andamento", 409)
            # reabrir uma partida encerrada mantem o cronometro de quem ja jogava
            if sala["status"] == "aguardando" or not sala.get("iniciada_em"):
                sala["iniciada_em"] = agora_iso()
            sala["status"] = "em_jogo"
            sala["finalizada_em"] = None
        elif acao == "encerrar":
            if sala["status"] != "em_jogo":
                raise ErroArena("A partida não está em andamento", 409)
            sala["status"] = "finalizada"
            sala["finalizada_em"] = agora_iso()
            for jogador in sala["jogadores"].values():
                jogador["ajuda"] = None
        elif acao == "reiniciar":
            sala["status"] = "aguardando"
            sala["iniciada_em"] = None
            sala["finalizada_em"] = None
            for jogador in sala["jogadores"].values():
                jogador.update({"concluiu": False, "tempo": None, "blocos": None, "estrelas": None,
                                "tentativas": 0, "dicas": 0, "ajuda": None, "ultimo_erro": None,
                                "entrou_em": agora_iso()})
        else:
            raise ErroArena("Ação inválida")
        _salvar_sala(cursor, sala)
        if acao != "iniciar":
            _salvar_jogadores(cursor, sala)
        return sala


def responder_ajuda(sala_id, professor, aluno_id, acao):
    with db.transacao() as cursor:
        sala = _sala_do_professor(cursor, sala_id, professor["id"], bloquear=True)
        jogador = sala["jogadores"].get(str(aluno_id))
        if not jogador or not jogador.get("ajuda"):
            raise ErroArena("Este pedido de ajuda já foi encerrado", 404)
        if acao == "a_caminho":
            jogador["ajuda"].update({"status": "a_caminho", "ajudante": professor["nome"].split()[0],
                                     "ajudante_professor": True})
        elif acao == "resolvido":
            jogador["ajuda"] = None
            jogador["ajudas_recebidas"] = jogador.get("ajudas_recebidas", 0) + 1
        else:
            raise ErroArena("Ação inválida")
        _salvar_jogadores(cursor, sala, [aluno_id])
        return sala


# ---------------------------------------------------------------------------
# Operacoes do aluno
# ---------------------------------------------------------------------------

def buscar_por_codigo(codigo):
    codigo = str(codigo or "").strip().upper()
    if not codigo.startswith("ARN-"):
        return None
    with db.transacao() as cursor:
        return _carregar_sala(cursor, "codigo = %s", (codigo,))


def _sala_por_codigo(cursor, codigo):
    """Arena do codigo, travada ate o fim da transacao."""
    codigo = str(codigo or "").strip().upper()
    sala = _carregar_sala(cursor, "codigo = %s", (codigo,), bloquear=True)
    if not sala:
        raise ErroArena("Arena não encontrada. Confira o código com o professor", 404)
    return sala


# So joga na Arena quem esta na turma do professor que a criou (entrou com o
# codigo RBT no painel). Vale para abrir a arena, entrar em equipe e jogar.
FORA_DA_TURMA = "Para jogar na Arena, primeiro entre na turma do professor com o código RBT"


def aluno_da_turma(sala, aluno):
    """O aluno esta na turma do professor que criou esta arena?"""
    return str(aluno.get("professor_id")) == str(sala["professor_id"])


def _conferir_turma(sala, aluno):
    if not aluno_da_turma(sala, aluno):
        raise ErroArena(FORA_DA_TURMA, 403)


def _jogador(sala, aluno):
    _conferir_turma(sala, aluno)
    jogador = sala["jogadores"].get(str(aluno["id"]))
    if not jogador:
        raise ErroArena("Escolha uma equipe para entrar na arena", 403)
    return jogador


def registrar_visita(sala, aluno_id):
    """Marca o aluno como online (vale para todas as instancias do servidor)."""
    visto = agora()
    with db.transacao() as cursor:
        cursor.execute(
            "update public.arena_jogadores set visto_em = %s where arena_id = %s and aluno_id = %s",
            (visto, sala["id"], int(aluno_id)),
        )
    jogador = sala.get("jogadores", {}).get(str(aluno_id))
    if jogador:
        jogador["visto_em"] = visto.isoformat()


def arenas_do_aluno(aluno_id, professor_id):
    """Ultimas arenas em que o aluno jogou, so as do professor da turma dele."""
    if not professor_id:
        return []
    with db.transacao() as cursor:
        cursor.execute(
            """
            select a.codigo, a.nome, a.status, a.professor_nome, j.concluiu
              from public.arena_jogadores j
              join public.arenas a on a.id = j.arena_id
             where j.aluno_id = %s and a.professor_id = %s
             order by j.entrou_em desc
             limit 5
            """,
            (int(aluno_id), int(professor_id)),
        )
        return [dict(linha) for linha in cursor.fetchall()]


def entrar_na_equipe(codigo, aluno, nome_equipe, cor=None, icone=None):
    nome_equipe = " ".join(str(nome_equipe or "").split())[:24]
    if len(nome_equipe) < 2:
        raise ErroArena("Dê um nome para a sua equipe")
    chave = _chave_equipe(nome_equipe)

    with db.transacao() as cursor:
        sala = _sala_por_codigo(cursor, codigo)
        _conferir_turma(sala, aluno)
        if sala["status"] == "finalizada":
            raise ErroArena("Esta partida já terminou", 410)

        equipes = sala.setdefault("equipes", {})
        jogadores = sala.setdefault("jogadores", {})
        membros = [j for j in jogadores.values() if j.get("equipe") == chave and str(j["id"]) != str(aluno["id"])]

        if chave not in equipes:
            ativas = {j.get("equipe") for j in jogadores.values()}
            if len(ativas) >= MAX_EQUIPES:
                raise ErroArena("A arena já tem equipes demais. Entre em uma equipe existente")
            equipes[chave] = {
                "nome": nome_equipe,
                "cor": cor if cor in CORES_EQUIPE else random.choice(CORES_EQUIPE),
                "icone": icone if icone in ICONES_EQUIPE else random.choice(ICONES_EQUIPE),
            }
            _salvar_equipe(cursor, sala, chave)
        elif len(membros) >= MAX_JOGADORES_EQUIPE:
            raise ErroArena(f"Essa equipe já tem {MAX_JOGADORES_EQUIPE} jogadores. Escolha outra!", 409)

        jogador = jogadores.get(str(aluno["id"]))
        if jogador:
            jogador["equipe"] = chave
            jogador["ajuda"] = None
        else:
            jogadores[str(aluno["id"])] = {
                "id": aluno["id"],
                "nome": aluno["nome"],
                "equipe": chave,
                "entrou_em": agora_iso(),
                "tentativas": 0,
                "dicas": 0,
                "concluiu": False,
                "tempo": None,
                "blocos": None,
                "estrelas": None,
                "ajuda": None,
                "ajudas_recebidas": 0,
                "ultimo_erro": None,
            }
        _salvar_jogadores(cursor, sala, [aluno["id"]])
        return sala


def executar_programa(codigo, aluno, programa):
    aluno_id = aluno["id"]
    comandos, total_blocos = expandir_programa(programa)
    with db.transacao() as cursor:
        sala = _sala_por_codigo(cursor, codigo)
        jogador = _jogador(sala, aluno)
        if sala["status"] != "em_jogo":
            raise ErroArena("A partida ainda não começou" if sala["status"] == "aguardando"
                            else "Esta partida já terminou", 409)
        limite = sala.get("limite_blocos") or 0
        if limite and total_blocos > limite:
            raise ErroArena(f"Nesta arena você pode usar até {limite} blocos")

        resultado = simular(sala, comandos)
        ja_concluiu = bool(jogador.get("concluiu"))
        resultado.update({"ja_concluiu": ja_concluiu, "blocos": total_blocos})

        if not ja_concluiu:
            jogador["tentativas"] = jogador.get("tentativas", 0) + 1
            if resultado["sucesso"]:
                inicio = _inicio_do_jogador(sala, jogador) or agora_iso()
                jogador.update({
                    "concluiu": True,
                    "concluiu_em": agora_iso(),
                    "tempo": _segundos_entre(inicio, agora_iso()),
                    "blocos": total_blocos,
                    "estrelas": calcular_estrelas(jogador["tentativas"], jogador.get("dicas", 0)),
                    "ajuda": None,
                    "ultimo_erro": None,
                })
            else:
                jogador["ultimo_erro"] = resultado["motivo"]
            _salvar_jogadores(cursor, sala, [aluno_id])

        resultado.update({
            "tempo": jogador.get("tempo"),
            "estrelas": jogador.get("estrelas"),
            "tentativas": jogador.get("tentativas", 0),
            "ranking": ranking(sala),
        })
        return resultado


def pedir_dica(codigo, aluno):
    """Cada pedido revela um pouco mais do caminho (3 niveis)."""
    aluno_id = aluno["id"]
    with db.transacao() as cursor:
        sala = _sala_por_codigo(cursor, codigo)
        jogador = _jogador(sala, aluno)
        solucao = solucao_minima(sala["tamanho"], sala["mapa"], sala["direcao"]) or []
        nivel = min(jogador.get("dicas", 0) + 1, 3)
        if not jogador.get("concluiu") and jogador.get("dicas", 0) < 3:
            jogador["dicas"] = jogador.get("dicas", 0) + 1
            _salvar_jogadores(cursor, sala, [aluno_id])

    casas = caminho_das_celulas(sala["tamanho"], sala["mapa"], sala["direcao"], solucao)
    quantidade = {1: 0, 2: max(2, len(casas) // 3), 3: len(casas)}[nivel]
    return {
        "nivel": nivel,
        "primeiros_comandos": solucao[:3] if nivel >= 2 else [],
        "casas": casas[:quantidade],
        "total_comandos": len(solucao),
    }


def pedir_ajuda(codigo, aluno, tipo, motivo=None):
    """Abre (ou renova) o pedido de ajuda do aluno.

    A ajuda e presencial: a equipe ou o professor vao ate o computador do aluno.
    Se a equipe nao resolver no tempo de chamada, o aluno chama o professor com o
    motivo ``equipe_toda`` ("A equipe toda esta com duvida").
    """
    if tipo not in ("equipe", "professor"):
        raise ErroArena("Tipo de ajuda inválido")
    if tipo == "professor" and motivo not in MOTIVOS_AJUDA and motivo != MOTIVO_EQUIPE_TODA:
        raise ErroArena("Conte para o professor qual é a dúvida")
    aluno_id = aluno["id"]
    with db.transacao() as cursor:
        sala = _sala_por_codigo(cursor, codigo)
        jogador = _jogador(sala, aluno)
        if sala["status"] != "em_jogo":
            raise ErroArena("A partida não está em andamento", 409)
        if tipo == "equipe":
            colegas = [j for j in sala["jogadores"].values()
                       if j.get("equipe") == jogador["equipe"] and str(j["id"]) != str(aluno_id)]
            if not colegas:
                raise ErroArena("Você ainda está sozinho na equipe. Chame o professor!", 409)
            motivo_texto = "Pediu ajuda à equipe"
        elif motivo == MOTIVO_EQUIPE_TODA:
            motivo_texto = TEXTO_EQUIPE_TODA
        else:
            motivo_texto = MOTIVOS_AJUDA[motivo]
        jogador["ajuda"] = {
            "tipo": tipo,
            "motivo": motivo if tipo == "professor" else None,
            "motivo_texto": motivo_texto,
            "pedida_em": agora_iso(),
            "status": "aberta",
            "ajudante": None,
        }
        _salvar_jogadores(cursor, sala, [aluno_id])
        return sala


def cancelar_ajuda(codigo, aluno):
    aluno_id = aluno["id"]
    with db.transacao() as cursor:
        sala = _sala_por_codigo(cursor, codigo)
        jogador = _jogador(sala, aluno)
        if jogador.get("ajuda") and jogador["ajuda"].get("ajudante"):
            jogador["ajudas_recebidas"] = jogador.get("ajudas_recebidas", 0) + 1
        jogador["ajuda"] = None
        _salvar_jogadores(cursor, sala, [aluno_id])
        return sala


def oferecer_ajuda(codigo, ajudante, colega_id):
    with db.transacao() as cursor:
        sala = _sala_por_codigo(cursor, codigo)
        eu = _jogador(sala, ajudante)
        colega = sala["jogadores"].get(str(colega_id))
        if not colega or colega.get("equipe") != eu.get("equipe") or not colega.get("ajuda"):
            raise ErroArena("Esse pedido de ajuda já foi resolvido", 404)
        if colega["ajuda"].get("ajudante_professor"):
            raise ErroArena("O professor já está ajudando", 409)
        colega["ajuda"].update({
            "status": "a_caminho",
            "ajudante": ajudante["nome"].split()[0],
            "ajudante_id": ajudante["id"],
        })
        _salvar_jogadores(cursor, sala, [colega_id])
        return sala
