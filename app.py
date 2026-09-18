from datetime import datetime, timedelta, timezone
from pathlib import Path
import secrets
import tempfile

from flask import Flask, jsonify, redirect, render_template, request, url_for
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from werkzeug.security import generate_password_hash, check_password_hash
import os
import json
from dotenv import load_dotenv

import trilha_store
from trilha_conteudo import CORES_DISPONIVEIS, ROTULOS_MINIJOGO, TIPOS_MINIJOGO
from jogo_conteudo import (
    COMANDOS_PERMITIDOS,
    DESLOCAMENTOS,
    FASES_JOGO,
    FASES_POR_ID,
    ORIENTACOES,
    TAMANHO_MAPA,
)

# ============================================
# CONFIGURAÇÕES
# ============================================

load_dotenv()

app = Flask(__name__)
app.config["SECRET_KEY"] = (
    os.getenv("SECRET_KEY")
    or os.getenv("FLASK_SECRET_KEY")
    or "robooteam-chave-local-de-testes"
)
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0

diretorio_projeto = Path(app.root_path)
diretorio_dados = diretorio_projeto

if os.getenv("VERCEL"):
    # Vercel Functions permitem escrita somente no diretório temporário.
    # Os dados ficam disponíveis enquanto a instância estiver ativa, mas não
    # substituem um banco de dados persistente.
    diretorio_dados = Path(tempfile.gettempdir()) / "robooteam"
    diretorio_dados.mkdir(parents=True, exist_ok=True)

usuarios_json_path = diretorio_dados / "usuarios_teste.json"
usuarios_iniciais_path = diretorio_projeto / "usuarios_teste.json"

if (
    os.getenv("VERCEL")
    and not usuarios_json_path.exists()
    and usuarios_iniciais_path.exists()
):
    usuarios_json_path.write_bytes(usuarios_iniciais_path.read_bytes())

token_serializer = URLSafeTimedSerializer(app.config["SECRET_KEY"], salt="robooteam-login")


def carregar_usuarios_json():
    if not usuarios_json_path.exists():
        return []

    try:
        usuarios = json.loads(usuarios_json_path.read_text(encoding="utf-8"))
        return usuarios if isinstance(usuarios, list) else []
    except (OSError, json.JSONDecodeError):
        return []


def salvar_usuarios_json(usuarios):
    arquivo_temporario = usuarios_json_path.with_suffix(".tmp")
    arquivo_temporario.write_text(
        json.dumps(usuarios, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    arquivo_temporario.replace(usuarios_json_path)


def gerar_token_json(usuario):
    return token_serializer.dumps({
        "id": usuario["id"],
        "perfil": usuario["perfil"],
        "email": usuario["email"],
    })


def obter_usuario_autenticado(perfil=None):
    authorization = request.headers.get("Authorization", "")
    token = authorization.removeprefix("Bearer ").strip() if authorization.startswith("Bearer ") else None
    token = token or request.cookies.get("robooteam_token")

    if not token:
        return None, (jsonify({"error": "Faça login para continuar"}), 401)

    try:
        payload = token_serializer.loads(token, max_age=60 * 60 * 24 * 30)
    except SignatureExpired:
        return None, (jsonify({"error": "Sua sessão expirou. Entre novamente"}), 401)
    except BadSignature:
        return None, (jsonify({"error": "Sessão inválida"}), 401)

    usuario = next(
        (item for item in carregar_usuarios_json() if int(item.get("id", -1)) == int(payload.get("id", -2))),
        None,
    )

    if not usuario:
        return None, (jsonify({"error": "Usuário não encontrado"}), 401)

    if perfil and usuario.get("perfil") != perfil:
        return None, (jsonify({"error": "Você não possui acesso a esta área"}), 403)

    return usuario, None


def trilha_do_aluno(usuario):
    """Atividades que este aluno enxerga (a do professor da sala, ou a padrao)."""
    return trilha_store.trilha_para_aluno(usuario)


def aula_da_atividade(atividade):
    """Recorte da atividade usado pela pagina da aula."""
    return {
        "eyebrow": atividade.get("eyebrow") or atividade["period"],
        "title": atividade.get("lesson_title") or atividade["title"],
        "intro": atividade.get("intro") or atividade["description"],
        "sections": atividade.get("sections", []),
        "quiz": atividade.get("quiz", []),
        "minigame": atividade.get("minigame") or {"type": "nenhum"},
    }


def resumo_do_minijogo(atividade):
    minijogo = atividade.get("minigame") or {}
    tipo = minijogo.get("type", "nenhum")
    return {
        "type": tipo,
        "label": ROTULOS_MINIJOGO.get(tipo, "Atividade pratica"),
        "title": minijogo.get("title", ""),
    }


def fases_jogo_concluidas(usuario):
    """Normaliza o progresso salvo e descarta ids que nao pertencem ao jogo."""
    ids_validos = set(FASES_POR_ID)
    concluidas = set()

    for fase_id in usuario.get("fases_jogo_concluidas", []):
        try:
            fase_id = int(fase_id)
        except (TypeError, ValueError):
            continue

        if fase_id in ids_validos:
            concluidas.add(fase_id)

    return sorted(concluidas)


def primeira_fase_jogo_pendente(concluidas):
    concluidas = set(concluidas)
    return next((fase["id"] for fase in FASES_JOGO if fase["id"] not in concluidas), None)


def resumo_progresso_jogo(usuario):
    concluidas = fases_jogo_concluidas(usuario)
    fase_atual = primeira_fase_jogo_pendente(concluidas)
    pontuacoes = usuario.get("pontuacoes_jogo", {})
    if not isinstance(pontuacoes, dict):
        pontuacoes = {}

    pontos = 0
    for valor in pontuacoes.values():
        if isinstance(valor, (int, float)) and not isinstance(valor, bool):
            pontos += int(valor)

    total = len(FASES_JOGO)
    quantidade_concluida = len(concluidas)
    return {
        "concluidas": concluidas,
        "quantidade_concluida": quantidade_concluida,
        "total": total,
        "percentual": round((quantidade_concluida / total) * 100) if total else 0,
        "pontos": pontos,
        "fase_atual": fase_atual,
        "fase_desbloqueada": fase_atual,
        "jogo_concluido": fase_atual is None,
    }


def simular_fase_jogo(fase, comandos):
    linha = fase["spawn"]["linha"]
    coluna = fase["spawn"]["coluna"]
    orientacao = fase["spawn"]["orientacao"]
    paredes = {(item["linha"], item["coluna"]) for item in fase["paredes"]}
    bandeira = (fase["bandeira"]["linha"], fase["bandeira"]["coluna"])
    movimentos = []

    for indice, comando in enumerate(comandos):
        if comando == "virar_esquerda":
            orientacao = ORIENTACOES[(ORIENTACOES.index(orientacao) - 1) % len(ORIENTACOES)]
        elif comando == "virar_direita":
            orientacao = ORIENTACOES[(ORIENTACOES.index(orientacao) + 1) % len(ORIENTACOES)]
        else:
            deslocamento_linha, deslocamento_coluna = DESLOCAMENTOS[orientacao]
            proxima_linha = linha + deslocamento_linha
            proxima_coluna = coluna + deslocamento_coluna

            if not (
                0 <= proxima_linha < TAMANHO_MAPA
                and 0 <= proxima_coluna < TAMANHO_MAPA
            ):
                return {
                    "sucesso": False,
                    "motivo": "fora_do_mapa",
                    "indice_erro": indice,
                    "comando_erro": comando,
                    "posicao_final": {"linha": linha, "coluna": coluna},
                    "orientacao_final": orientacao,
                    "movimentos": movimentos,
                    "blocos_executados": len(movimentos),
                }

            if (proxima_linha, proxima_coluna) in paredes:
                return {
                    "sucesso": False,
                    "motivo": "parede",
                    "indice_erro": indice,
                    "comando_erro": comando,
                    "posicao_final": {"linha": linha, "coluna": coluna},
                    "orientacao_final": orientacao,
                    "movimentos": movimentos,
                    "blocos_executados": len(movimentos),
                }

            linha = proxima_linha
            coluna = proxima_coluna

        movimentos.append({
            "indice": indice,
            "comando": comando,
            "linha": linha,
            "coluna": coluna,
            "orientacao": orientacao,
        })

        if (linha, coluna) == bandeira:
            return {
                "sucesso": True,
                "motivo": "bandeira_alcancada",
                "indice_vitoria": indice,
                "posicao_final": {"linha": linha, "coluna": coluna},
                "orientacao_final": orientacao,
                "movimentos": movimentos,
                "blocos_executados": len(movimentos),
            }

    return {
        "sucesso": False,
        "motivo": "bandeira_nao_alcancada",
        "posicao_final": {"linha": linha, "coluna": coluna},
        "orientacao_final": orientacao,
        "movimentos": movimentos,
        "blocos_executados": len(movimentos),
    }


@app.after_request
def desativar_cache_de_desenvolvimento(response):
    if request.path.startswith("/static/") or response.mimetype == "text/html":
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response


# ============================================
# PÁGINAS JINJA
# ============================================

@app.get("/")
def pagina_inicial():
    return render_template("index.html")


@app.get("/login")
def pagina_login():
    return render_template("login.html")


@app.get("/aluno")
def pagina_aluno():
    usuario, erro = obter_usuario_autenticado("ALUNO")
    if erro:
        return redirect(url_for("pagina_login", next=request.path))
    return render_template("aluno.html", usuario=usuario)


@app.get("/aluno/jogo")
def pagina_jogo_blocos():
    usuario, erro = obter_usuario_autenticado("ALUNO")
    if erro:
        return redirect(url_for("pagina_login", next=request.path))

    if not usuario.get("professor_id"):
        return redirect(url_for("pagina_aluno", _anchor="sala"))

    return render_template("jogo_blocos.html", usuario=usuario)


@app.get("/professor")
def pagina_professor():
    usuario, erro = obter_usuario_autenticado("PROFESSOR")
    if erro:
        return redirect(url_for("pagina_login", next=request.path))
    return render_template("professor.html", usuario=usuario)


@app.get("/aluno/trilha/etapa/<int:lesson_id>")
def pagina_etapa_trilha(lesson_id):
    usuario, erro = obter_usuario_autenticado("ALUNO")
    if erro:
        return redirect(url_for("pagina_login", next=request.path))

    atividades = trilha_do_aluno(usuario)
    atividade = trilha_store.buscar_atividade(atividades, lesson_id)
    if not atividade:
        return "Etapa não encontrada", 404

    concluidas = trilha_store.normalizar_concluidas(atividades, usuario.get("etapas_concluidas", []))
    etapa_pendente = trilha_store.primeira_pendente(atividades, concluidas)
    if lesson_id not in concluidas and lesson_id != etapa_pendente:
        return redirect(url_for("pagina_aluno", _anchor="trilha"))

    posicao = trilha_store.ids_das_atividades(atividades).index(lesson_id)

    return render_template(
        "trilha_aula.html",
        lesson=aula_da_atividade(atividade),
        lesson_id=lesson_id,
        usuario=usuario,
        posicao=posicao + 1,
        total_etapas=len(atividades),
        ja_concluida=lesson_id in concluidas,
    )


# ============================================
# LOGIN
# ============================================

@app.post("/api/login")
def login():

    dados = request.get_json(silent=True) or request.form.to_dict()

    if not dados:
        return jsonify({"error": "Envie os dados"}), 400

    email = str(dados.get("email", "")).strip().lower()
    senha = dados.get("senha")

    if not email or not senha:
        return jsonify({"error": "Email e senha obrigatórios"}), 400

    usuario = next(
        (item for item in carregar_usuarios_json() if item.get("email", "").lower() == email),
        None,
    )

    if not usuario or not check_password_hash(usuario["senha"], senha):
        return jsonify({"error": "E-mail ou senha incorretos"}), 401

    token = gerar_token_json(usuario)

    response = jsonify({
        "message": "Login realizado",
        "token": token,
        "perfil": usuario["perfil"],
        "nome": usuario["nome"],
        "email": usuario["email"],
    })
    lembrar = bool(dados.get("lembrar"))
    response.set_cookie(
        "robooteam_token",
        token,
        max_age=60 * 60 * 24 * 30 if lembrar else None,
        httponly=True,
        samesite="Lax",
        secure=bool(os.getenv("VERCEL")),
    )
    return response, 200


@app.post("/api/logout")
def logout():
    response = jsonify({"message": "Sessão encerrada"})
    response.delete_cookie("robooteam_token", samesite="Lax")
    return response


# ============================================
# CADASTRO LOCAL PARA TESTES
# ============================================

@app.post("/api/cadastro")
def cadastrar_usuario_json():
    dados = request.get_json(silent=True) or {}
    nome = str(dados.get("nome", "")).strip()
    email = str(dados.get("email", "")).strip().lower()
    senha = str(dados.get("senha", ""))
    perfil_recebido = str(dados.get("perfil", "")).strip().lower()
    perfis = {"aluno": "ALUNO", "educador": "PROFESSOR", "professor": "PROFESSOR"}
    perfil = perfis.get(perfil_recebido)

    if len(nome) < 3 or not email or len(senha) < 8 or not perfil:
        return jsonify({"error": "Dados de cadastro inválidos"}), 400

    usuarios = carregar_usuarios_json()
    if any(usuario.get("email", "").lower() == email for usuario in usuarios):
        return jsonify({"error": "Já existe uma conta com este e-mail"}), 409

    novo_id = max((int(usuario.get("id", 0)) for usuario in usuarios), default=0) + 1
    usuarios.append({
        "id": novo_id,
        "nome": nome,
        "email": email,
        "senha": generate_password_hash(senha),
        "perfil": perfil,
        "turma": None,
        "etapas_concluidas": [],
        "pontuacoes": {},
        "fases_jogo_concluidas": [],
        "pontuacoes_jogo": {},
        "progresso_atualizado_em": None,
    })

    try:
        salvar_usuarios_json(usuarios)
    except OSError:
        return jsonify({"error": "Não foi possível salvar o cadastro"}), 500

    return jsonify({"message": "Cadastro realizado", "perfil": perfil}), 201


# ============================================
# TRILHA DO ALUNO
# ============================================

@app.get("/api/aluno/trilha")
def obter_trilha_aluno():
    usuario, erro = obter_usuario_autenticado("ALUNO")
    if erro:
        return erro

    atividades = trilha_do_aluno(usuario)
    concluidas = trilha_store.normalizar_concluidas(atividades, usuario.get("etapas_concluidas", []))
    etapa_atual = trilha_store.primeira_pendente(atividades, concluidas)
    itens = []

    for posicao, item in enumerate(atividades, start=1):
        item_id = int(item["id"])
        if item_id in concluidas:
            estado = "concluida"
        elif item_id == etapa_atual:
            estado = "atual"
        else:
            estado = "bloqueada"

        itens.append({
            "id": item_id,
            "posicao": posicao,
            "period": item["period"],
            "title": item["title"],
            "description": item["description"],
            "color": item.get("color", "blue"),
            "estado": estado,
            "minijogo": resumo_do_minijogo(item),
            "url": url_for("pagina_etapa_trilha", lesson_id=item_id),
        })

    total = len(atividades)
    quantidade_concluida = len(concluidas)
    percentual = round((quantidade_concluida / total) * 100) if total else 0
    pontos = quantidade_concluida * 100
    nivel = 1 + quantidade_concluida // 2
    proxima = next((item for item in itens if item["estado"] == "atual"), None)
    professor_id = usuario.get("professor_id")
    professor = next(
        (
            item
            for item in carregar_usuarios_json()
            if item.get("perfil") == "PROFESSOR"
            and str(item.get("id")) == str(professor_id)
        ),
        None,
    )
    sala = None
    if professor:
        sala = {
            "turma": usuario.get("turma") or professor.get("turma_nome") or f"Turma de {professor['nome']}",
            "professor": professor["nome"],
        }

    return jsonify({
        "title": "Conhecendo a inteligência artificial",
        "usuario": {
            "id": usuario["id"],
            "nome": usuario["nome"],
            "email": usuario["email"],
            "turma": usuario.get("turma"),
        },
        "sala": sala,
        "items": itens,
        "progress": {
            "completed": quantidade_concluida,
            "total": total,
            "percent": percentual,
            "points": pontos,
            "level": nivel,
        },
        "next": proxima,
    })


@app.post("/api/aluno/trilha/etapa/<int:lesson_id>/concluir")
def concluir_etapa_trilha(lesson_id):
    usuario, erro = obter_usuario_autenticado("ALUNO")
    if erro:
        return erro

    atividades = trilha_do_aluno(usuario)
    atividade = trilha_store.buscar_atividade(atividades, lesson_id)
    if not atividade:
        return jsonify({"error": "Etapa não encontrada"}), 404

    dados = request.get_json(silent=True) or {}
    respostas = dados.get("respostas")
    respostas_corretas = [questao["answer"] for questao in atividade.get("quiz", [])]

    tipo_minijogo = (atividade.get("minigame") or {}).get("type", "nenhum")
    if tipo_minijogo != "nenhum" and not bool(dados.get("minijogo_concluido")):
        return jsonify({
            "error": "Conclua também a atividade prática desta etapa antes de finalizar",
            "minijogo": tipo_minijogo,
        }), 400

    if not isinstance(respostas, list) or len(respostas) != len(respostas_corretas):
        return jsonify({"error": "Responda todas as perguntas antes de concluir"}), 400

    try:
        respostas_normalizadas = [int(resposta) for resposta in respostas]
    except (TypeError, ValueError):
        return jsonify({"error": "Formato de respostas inválido"}), 400

    acertos = sum(
        resposta == resposta_correta
        for resposta, resposta_correta in zip(respostas_normalizadas, respostas_corretas)
    )
    if acertos != len(respostas_corretas):
        return jsonify({
            "error": "Revise as respostas incorretas antes de concluir",
            "acertos": acertos,
            "total": len(respostas_corretas),
        }), 400

    usuarios = carregar_usuarios_json()
    usuario_salvo = next(item for item in usuarios if int(item["id"]) == int(usuario["id"]))
    concluidas = trilha_store.normalizar_concluidas(atividades, usuario_salvo.get("etapas_concluidas", []))
    etapa_atual = trilha_store.primeira_pendente(atividades, concluidas)

    if lesson_id not in concluidas and lesson_id != etapa_atual:
        return jsonify({"error": "Conclua a etapa anterior primeiro"}), 409

    if lesson_id not in concluidas:
        concluidas.append(lesson_id)
        concluidas.sort()

    usuario_salvo["etapas_concluidas"] = concluidas
    usuario_salvo.setdefault("pontuacoes", {})[str(lesson_id)] = acertos
    usuario_salvo["progresso_atualizado_em"] = datetime.now(timezone.utc).isoformat()

    try:
        salvar_usuarios_json(usuarios)
    except OSError:
        return jsonify({"error": "Não foi possível salvar o progresso"}), 500

    proxima_id = trilha_store.primeira_pendente(atividades, concluidas)
    proxima = trilha_store.buscar_atividade(atividades, proxima_id) if proxima_id else None

    return jsonify({
        "message": "Etapa concluída",
        "completed": concluidas,
        "next": proxima_id,
        "next_title": proxima["title"] if proxima else None,
        "total": len(atividades),
    })


# ============================================
# JOGO DE PROGRAMACAO EM BLOCOS
# ============================================

@app.get("/api/aluno/jogo")
def dados_jogo_blocos():
    usuario, erro = obter_usuario_autenticado("ALUNO")
    if erro:
        return erro

    if not usuario.get("professor_id"):
        return jsonify({
            "error": "Entre em uma sala antes de iniciar o jogo",
            "redirect_url": url_for("pagina_aluno", _anchor="sala"),
        }), 403

    progresso = resumo_progresso_jogo(usuario)
    concluidas = set(progresso["concluidas"])
    fase_atual = progresso["fase_atual"]
    fases = []

    for fase in FASES_JOGO:
        fase_id = fase["id"]
        if fase_id in concluidas:
            estado = "concluida"
        elif fase_id == fase_atual:
            estado = "atual"
        else:
            estado = "bloqueada"

        fase_formatada = dict(fase)
        fase_formatada.update({
            "base_coordenadas": 0,
            "tamanho": {"linhas": TAMANHO_MAPA, "colunas": TAMANHO_MAPA},
            "estado": estado,
            "url_concluir": url_for("concluir_fase_jogo_blocos", phase_id=fase_id),
            "mascote_url": url_for("static", filename=f"img/{fase_id}.png"),
        })
        fases.append(fase_formatada)

    return jsonify({
        "titulo": "Missão Robô: programe o caminho",
        "usuario": {
            "id": usuario["id"],
            "nome": usuario["nome"],
            "turma": usuario.get("turma"),
        },
        "base_coordenadas": 0,
        "tamanho": {"linhas": TAMANHO_MAPA, "colunas": TAMANHO_MAPA},
        "orientacoes": list(ORIENTACOES),
        "comandos_permitidos": list(COMANDOS_PERMITIDOS),
        "fases": fases,
        "progresso": progresso,
        "fase_atual": fase_atual,
        "fase_desbloqueada": progresso["fase_desbloqueada"],
    })


@app.post("/api/aluno/jogo/fase/<int:phase_id>/concluir")
def concluir_fase_jogo_blocos(phase_id):
    usuario, erro = obter_usuario_autenticado("ALUNO")
    if erro:
        return erro

    if not usuario.get("professor_id"):
        return jsonify({
            "error": "Entre em uma sala antes de iniciar o jogo",
            "redirect_url": url_for("pagina_aluno", _anchor="sala"),
        }), 403

    fase = FASES_POR_ID.get(phase_id)
    if not fase:
        return jsonify({"error": "Fase não encontrada"}), 404

    concluidas_usuario = fases_jogo_concluidas(usuario)
    fase_atual = primeira_fase_jogo_pendente(concluidas_usuario)
    if phase_id not in concluidas_usuario and phase_id != fase_atual:
        return jsonify({
            "error": "Conclua a fase anterior primeiro",
            "fase_desbloqueada": fase_atual,
        }), 409

    dados = request.get_json(silent=True) or {}
    comandos = dados.get("comandos")
    if not isinstance(comandos, list):
        return jsonify({
            "error": "Envie os comandos em uma lista",
            "comandos_permitidos": list(COMANDOS_PERMITIDOS),
        }), 400

    comandos_invalidos = [
        comando
        for comando in comandos
        if not isinstance(comando, str) or comando not in COMANDOS_PERMITIDOS
    ]
    if comandos_invalidos:
        return jsonify({
            "error": "A sequência possui comandos inválidos",
            "comandos_invalidos": comandos_invalidos,
            "comandos_permitidos": list(COMANDOS_PERMITIDOS),
        }), 400

    if len(comandos) > fase["limite_blocos"]:
        return jsonify({
            "error": "A sequência ultrapassa o limite de blocos da fase",
            "limite_blocos": fase["limite_blocos"],
            "blocos_enviados": len(comandos),
        }), 400

    resultado = simular_fase_jogo(fase, comandos)
    if not resultado["sucesso"]:
        mensagens = {
            "fora_do_mapa": "O robô tentou sair do mapa",
            "parede": "O robô encontrou uma parede",
            "bandeira_nao_alcancada": "A sequência terminou antes de alcançar a bandeira",
        }
        return jsonify({
            "error": mensagens[resultado["motivo"]],
            "resultado": resultado,
        }), 422

    usuarios = carregar_usuarios_json()
    usuario_salvo = next(
        (item for item in usuarios if str(item.get("id")) == str(usuario["id"])),
        None,
    )
    if not usuario_salvo:
        return jsonify({"error": "Aluno não encontrado"}), 404

    concluidas = fases_jogo_concluidas(usuario_salvo)
    fase_atual_salva = primeira_fase_jogo_pendente(concluidas)
    if phase_id not in concluidas and phase_id != fase_atual_salva:
        return jsonify({
            "error": "Conclua a fase anterior primeiro",
            "fase_desbloqueada": fase_atual_salva,
        }), 409

    ja_concluida = phase_id in concluidas
    if not ja_concluida:
        concluidas.append(phase_id)
        concluidas.sort()

    pontos_obtidos = 100 + max(
        0,
        fase["limite_blocos"] - resultado["blocos_executados"],
    ) * 10
    pontuacoes_salvas = usuario_salvo.get("pontuacoes_jogo")
    pontuacoes = dict(pontuacoes_salvas) if isinstance(pontuacoes_salvas, dict) else {}

    pontuacao_anterior = pontuacoes.get(str(phase_id), 0)
    if not isinstance(pontuacao_anterior, (int, float)) or isinstance(pontuacao_anterior, bool):
        pontuacao_anterior = 0

    melhor_pontuacao = max(int(pontuacao_anterior), pontos_obtidos)
    houve_alteracao = (
        not ja_concluida
        or not isinstance(pontuacoes_salvas, dict)
        or melhor_pontuacao != int(pontuacao_anterior)
    )

    if houve_alteracao:
        pontuacoes[str(phase_id)] = melhor_pontuacao
        usuario_salvo["pontuacoes_jogo"] = pontuacoes
        usuario_salvo["fases_jogo_concluidas"] = concluidas
        usuario_salvo["jogo_atualizado_em"] = datetime.now(timezone.utc).isoformat()

        try:
            salvar_usuarios_json(usuarios)
        except OSError:
            return jsonify({"error": "Não foi possível salvar o progresso do jogo"}), 500

    progresso = resumo_progresso_jogo(usuario_salvo)
    return jsonify({
        "message": "Fase já concluída" if ja_concluida else "Fase concluída!",
        "fase_id": phase_id,
        "ja_concluida": ja_concluida,
        "pontos_obtidos": pontos_obtidos,
        "melhor_pontuacao": melhor_pontuacao,
        "resultado": resultado,
        "progresso": progresso,
        "fase_atual": progresso["fase_atual"],
        "fase_desbloqueada": progresso["fase_desbloqueada"],
    })


@app.post("/api/aluno/entrar-sala")
def entrar_sala_aluno():
    aluno, erro = obter_usuario_autenticado("ALUNO")
    if erro:
        return erro

    dados = request.get_json(silent=True) or {}
    codigo = str(dados.get("codigo", "")).strip().upper()
    if not codigo:
        return jsonify({"error": "Digite o código da sala"}), 400

    usuarios = carregar_usuarios_json()
    professor = next(
        (
            item
            for item in usuarios
            if item.get("perfil") == "PROFESSOR"
            and str(item.get("codigo_sala", "")).upper() == codigo
        ),
        None,
    )
    if not professor:
        return jsonify({"error": "Código de sala inválido"}), 404

    try:
        validade = datetime.fromisoformat(str(professor.get("codigo_validade", "")).replace("Z", "+00:00"))
        if validade.tzinfo is None:
            validade = validade.replace(tzinfo=timezone.utc)
    except ValueError:
        return jsonify({"error": "Este código de sala não está mais disponível"}), 410

    if validade.astimezone(timezone.utc) <= datetime.now(timezone.utc):
        return jsonify({"error": "Este código de sala expirou. Peça um novo ao professor"}), 410

    aluno_salvo = next(
        (item for item in usuarios if str(item.get("id")) == str(aluno["id"])),
        None,
    )
    if not aluno_salvo:
        return jsonify({"error": "Aluno não encontrado"}), 404

    ja_participa = str(aluno_salvo.get("professor_id")) == str(professor["id"])
    nome_turma = professor.get("turma_nome") or f"Turma de {professor['nome']}"
    professor["turma_nome"] = nome_turma
    aluno_salvo["professor_id"] = professor["id"]
    aluno_salvo["turma"] = nome_turma
    aluno_salvo["sala_entrada_em"] = datetime.now(timezone.utc).isoformat()

    try:
        salvar_usuarios_json(usuarios)
    except OSError:
        return jsonify({"error": "Não foi possível entrar na sala agora"}), 500

    return jsonify({
        "message": "Você já faz parte desta sala" if ja_participa else "Entrada na sala realizada com sucesso!",
        "redirect_url": url_for("pagina_jogo_blocos"),
        "sala": {
            "turma": nome_turma,
            "professor": professor["nome"],
        },
    }), 200


# ============================================
# DASHBOARD DO PROFESSOR
# ============================================

@app.get("/api/professor/resumo")
def obter_resumo_professor():
    professor, erro = obter_usuario_autenticado("PROFESSOR")
    if erro:
        return erro

    usuarios = carregar_usuarios_json()
    alunos = [
        usuario
        for usuario in usuarios
        if usuario.get("perfil") == "ALUNO"
        and str(usuario.get("professor_id")) == str(professor["id"])
    ]
    atividades = trilha_store.trilha_do_professor(professor["id"])
    total_etapas = len(atividades)
    alunos_formatados = []

    for aluno in alunos:
        concluidas = trilha_store.normalizar_concluidas(atividades, aluno.get("etapas_concluidas", []))
        percentual = round((len(concluidas) / total_etapas) * 100) if total_etapas else 0
        proxima_id = trilha_store.primeira_pendente(atividades, concluidas)
        proxima = next((item["title"] for item in atividades if int(item["id"]) == proxima_id), "Trilha concluída")
        alunos_formatados.append({
            "id": aluno["id"],
            "nome": aluno["nome"],
            "email": aluno["email"],
            "turma": aluno.get("turma") or professor.get("turma_nome") or f"Turma de {professor['nome']}",
            "concluidas": len(concluidas),
            "total": total_etapas,
            "percentual": percentual,
            "status": "Concluído" if percentual == 100 else "Em andamento" if percentual else "Não iniciado",
            "proxima": proxima,
            "atualizado_em": aluno.get("progresso_atualizado_em"),
        })

    media = round(sum(aluno["percentual"] for aluno in alunos_formatados) / len(alunos_formatados)) if alunos_formatados else 0
    iniciaram = sum(aluno["percentual"] > 0 for aluno in alunos_formatados)
    etapas_resumo = [
        {
            "id": int(item["id"]),
            "titulo": item["title"],
            "minijogo": resumo_do_minijogo(item),
            "conclusoes": sum(int(item["id"]) in aluno.get("etapas_concluidas", []) for aluno in alunos),
        }
        for item in atividades
    ]

    return jsonify({
        "professor": {
            "id": professor["id"],
            "nome": professor["nome"],
            "email": professor["email"],
            "disciplina": professor.get("disciplina") or "Inteligência Artificial e Robótica",
        },
        "metrics": {
            "total_alunos": len(alunos_formatados),
            "turmas_ativas": 1 if alunos_formatados else 0,
            "alunos_iniciaram": iniciaram,
            "total_atividades": total_etapas,
            "media_geral": media,
        },
        "alunos": alunos_formatados,
        "etapas": etapas_resumo,
        "turmas": [{
            "nome": professor.get("turma_nome") or f"Turma de {professor['nome']}",
            "quantidade": len(alunos_formatados),
            "status": "Ativa",
        }],
        "codigo_sala": professor.get("codigo_sala"),
        "codigo_validade": professor.get("codigo_validade"),
        "trilha_personalizada": trilha_store.usa_trilha_personalizada(professor["id"]),
    })


@app.post("/api/professor/codigo-sala")
def gerar_codigo_sala():
    professor, erro = obter_usuario_autenticado("PROFESSOR")
    if erro:
        return erro

    usuarios = carregar_usuarios_json()
    professor_salvo = next(item for item in usuarios if int(item["id"]) == int(professor["id"]))
    codigo = f"RBT-{secrets.token_hex(2).upper()}"
    validade = datetime.now(timezone.utc) + timedelta(hours=24)
    professor_salvo.setdefault("turma_nome", f"Turma de {professor['nome']}")
    professor_salvo["codigo_sala"] = codigo
    professor_salvo["codigo_validade"] = validade.isoformat()

    try:
        salvar_usuarios_json(usuarios)
    except OSError:
        return jsonify({"error": "Não foi possível gerar o código"}), 500

    return jsonify({
        "codigo": codigo,
        "validade": validade.isoformat(),
        "turma": professor_salvo["turma_nome"],
    }), 201


# ============================================
# ATIVIDADES DA TRILHA (CRUD DO PROFESSOR)
# ============================================

def contar_conclusoes_por_etapa(professor_id):
    """Quantos alunos da sala ja concluiram cada etapa."""
    contagem = {}
    for usuario in carregar_usuarios_json():
        if usuario.get("perfil") != "ALUNO":
            continue
        if str(usuario.get("professor_id")) != str(professor_id):
            continue
        for etapa in usuario.get("etapas_concluidas", []):
            try:
                etapa = int(etapa)
            except (TypeError, ValueError):
                continue
            contagem[etapa] = contagem.get(etapa, 0) + 1
    return contagem


def resposta_das_atividades(professor_id, mensagem=None, status=200):
    atividades = trilha_store.trilha_do_professor(professor_id)
    conclusoes = contar_conclusoes_por_etapa(professor_id)

    itens = []
    for posicao, atividade in enumerate(atividades, start=1):
        item = dict(atividade)
        item["posicao"] = posicao
        item["minijogo_label"] = ROTULOS_MINIJOGO.get(
            (atividade.get("minigame") or {}).get("type", "nenhum"),
            "Atividade prática",
        )
        item["total_perguntas"] = len(atividade.get("quiz", []))
        item["total_secoes"] = len(atividade.get("sections", []))
        item["conclusoes"] = conclusoes.get(int(atividade["id"]), 0)
        itens.append(item)

    corpo = {
        "atividades": itens,
        "total": len(itens),
        "personalizada": trilha_store.usa_trilha_personalizada(professor_id),
        "opcoes": {
            "cores": list(CORES_DISPONIVEIS),
            "minijogos": [
                {"valor": tipo, "rotulo": ROTULOS_MINIJOGO[tipo]}
                for tipo in TIPOS_MINIJOGO
            ],
        },
    }
    if mensagem:
        corpo["message"] = mensagem

    return jsonify(corpo), status


@app.get("/api/professor/atividades")
def listar_atividades_trilha():
    professor, erro = obter_usuario_autenticado("PROFESSOR")
    if erro:
        return erro
    return resposta_das_atividades(professor["id"])


@app.post("/api/professor/atividades")
def criar_atividade_trilha():
    professor, erro = obter_usuario_autenticado("PROFESSOR")
    if erro:
        return erro

    dados = request.get_json(silent=True) or {}
    posicao = dados.get("posicao")

    try:
        atividade = trilha_store.criar_atividade(
            professor["id"],
            dados,
            posicao if isinstance(posicao, int) else None,
        )
    except trilha_store.ErroDeValidacao as problema:
        return jsonify({"error": str(problema)}), 400
    except OSError:
        return jsonify({"error": "Não foi possível salvar a atividade"}), 500

    return resposta_das_atividades(
        professor["id"],
        f"Atividade \"{atividade['title']}\" criada com sucesso!",
        201,
    )


@app.put("/api/professor/atividades/<int:atividade_id>")
def atualizar_atividade_trilha(atividade_id):
    professor, erro = obter_usuario_autenticado("PROFESSOR")
    if erro:
        return erro

    try:
        atividade = trilha_store.atualizar_atividade(
            professor["id"],
            atividade_id,
            request.get_json(silent=True) or {},
        )
    except trilha_store.ErroDeValidacao as problema:
        return jsonify({"error": str(problema)}), 400
    except OSError:
        return jsonify({"error": "Não foi possível salvar a atividade"}), 500

    return resposta_das_atividades(
        professor["id"],
        f"Atividade \"{atividade['title']}\" atualizada!",
    )


@app.delete("/api/professor/atividades/<int:atividade_id>")
def remover_atividade_trilha(atividade_id):
    professor, erro = obter_usuario_autenticado("PROFESSOR")
    if erro:
        return erro

    try:
        atividade = trilha_store.remover_atividade(professor["id"], atividade_id)
    except trilha_store.ErroDeValidacao as problema:
        return jsonify({"error": str(problema)}), 400
    except OSError:
        return jsonify({"error": "Não foi possível remover a atividade"}), 500

    return resposta_das_atividades(
        professor["id"],
        f"Atividade \"{atividade['title']}\" removida da trilha.",
    )


@app.post("/api/professor/atividades/reordenar")
def reordenar_atividades_trilha():
    professor, erro = obter_usuario_autenticado("PROFESSOR")
    if erro:
        return erro

    dados = request.get_json(silent=True) or {}

    try:
        trilha_store.reordenar_atividades(professor["id"], dados.get("ids"))
    except trilha_store.ErroDeValidacao as problema:
        return jsonify({"error": str(problema)}), 400
    except OSError:
        return jsonify({"error": "Não foi possível salvar a nova ordem"}), 500

    return resposta_das_atividades(professor["id"], "Nova ordem da trilha salva!")


@app.post("/api/professor/atividades/restaurar")
def restaurar_atividades_trilha():
    professor, erro = obter_usuario_autenticado("PROFESSOR")
    if erro:
        return erro

    try:
        trilha_store.restaurar_padrao(professor["id"])
    except OSError:
        return jsonify({"error": "Não foi possível restaurar a trilha"}), 500

    return resposta_das_atividades(professor["id"], "Trilha original do RobooTeam restaurada.")


if __name__ == "__main__":
    app.run(debug=True)
