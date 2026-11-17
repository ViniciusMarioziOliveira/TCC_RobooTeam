# -*- coding: utf-8 -*-
"""Turmas da professora e os alunos de cada uma.

Cada turma tem nome, um codigo de entrada (RBT-XXXX, valido por 24 horas) e os
seus alunos. O aluno entra pelo codigo e fica em uma turma por vez
(``usuarios.turma_id``); ``usuarios.professor_id`` continua dizendo de qual
professora ele e (a trilha e a Arena dependem disso).
"""

import secrets
from datetime import datetime, timedelta, timezone

import psycopg

import db

PERFIL_ALUNO = "ALUNO"
NOME_MIN, NOME_MAX = 2, 60
MAXIMO_DE_TURMAS = 30
VALIDADE_DO_CODIGO = timedelta(hours=24)
# sem letras e numeros parecidos (0/O, 1/I/L): quem digita o codigo sao criancas
LETRAS_DO_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


class ErroTurma(ValueError):
    """Erro com mensagem pronta para a interface e status HTTP sugerido."""

    def __init__(self, mensagem, status=400):
        super().__init__(mensagem)
        self.status = status


def _formatar(linha):
    if not linha:
        return None
    return {
        chave: valor.isoformat() if isinstance(valor, datetime) else valor
        for chave, valor in linha.items()
    }


def _nome_da_turma(nome):
    nome = " ".join(str(nome or "").split())
    if not NOME_MIN <= len(nome) <= NOME_MAX:
        raise ErroTurma(f"O nome da turma precisa ter de {NOME_MIN} a {NOME_MAX} caracteres.")
    return nome


def _id(valor, mensagem):
    try:
        return int(valor)
    except (TypeError, ValueError):
        raise ErroTurma(mensagem, 404)


def codigo_valido(turma, agora=None):
    """O codigo da turma ainda pode ser usado pelos alunos?"""
    validade = (turma or {}).get("codigo_validade")
    if not turma or not turma.get("codigo") or not validade:
        return False
    if isinstance(validade, str):
        try:
            validade = datetime.fromisoformat(validade.replace("Z", "+00:00"))
        except ValueError:
            return False
    if validade.tzinfo is None:
        validade = validade.replace(tzinfo=timezone.utc)
    return validade > (agora or datetime.now(timezone.utc))


# ---------------------------------------------------------------------------
# Consultas
# ---------------------------------------------------------------------------

def listar(professor_id):
    """Turmas da professora com a quantidade de alunos, na ordem em que foram criadas."""
    with db.transacao() as cursor:
        cursor.execute(
            """
            select t.id, t.nome, t.codigo, t.codigo_validade, t.criada_em,
                   count(a.id) as total_alunos
              from public.turmas t
              left join public.usuarios a on a.turma_id = t.id and a.perfil = %s
             where t.professor_id = %s
             group by t.id
             order by t.criada_em, t.id
            """,
            (PERFIL_ALUNO, int(professor_id)),
        )
        return [_formatar(linha) for linha in cursor.fetchall()]


def buscar_por_codigo(codigo):
    """Turma dona do codigo (com o nome da professora) ou None."""
    with db.transacao() as cursor:
        cursor.execute(
            """
            select t.id, t.nome, t.codigo, t.codigo_validade, t.professor_id,
                   p.nome as professor_nome
              from public.turmas t
              join public.usuarios p on p.id = t.professor_id
             where upper(t.codigo) = %s
            """,
            (str(codigo or "").strip().upper(),),
        )
        return _formatar(cursor.fetchone())


# ---------------------------------------------------------------------------
# Turmas (painel da professora)
# ---------------------------------------------------------------------------

def criar(professor_id, nome):
    nome = _nome_da_turma(nome)
    try:
        with db.transacao() as cursor:
            # trava a professora: duas turmas criadas ao mesmo tempo nao furam o limite
            cursor.execute("select id from public.usuarios where id = %s for update", (int(professor_id),))
            cursor.execute(
                "select count(*) as total from public.turmas where professor_id = %s",
                (int(professor_id),),
            )
            if cursor.fetchone()["total"] >= MAXIMO_DE_TURMAS:
                raise ErroTurma(f"Você pode ter até {MAXIMO_DE_TURMAS} turmas. Exclua uma turma antiga antes.")
            cursor.execute(
                "insert into public.turmas (professor_id, nome) values (%s, %s) returning id, nome",
                (int(professor_id), nome),
            )
            return _formatar(cursor.fetchone())
    except psycopg.errors.UniqueViolation:
        raise ErroTurma(f"Você já tem uma turma chamada \"{nome}\".", 409)


def renomear(professor_id, turma_id, nome):
    nome = _nome_da_turma(nome)
    turma_id = _id(turma_id, "Turma não encontrada.")
    try:
        with db.transacao() as cursor:
            cursor.execute(
                "update public.turmas set nome = %s where id = %s and professor_id = %s returning id",
                (nome, turma_id, int(professor_id)),
            )
            if not cursor.fetchone():
                raise ErroTurma("Turma não encontrada.", 404)
            # o nome tambem fica guardado no aluno (aparece no painel dele)
            cursor.execute("update public.usuarios set turma = %s where turma_id = %s", (nome, turma_id))
    except psycopg.errors.UniqueViolation:
        raise ErroTurma(f"Você já tem uma turma chamada \"{nome}\".", 409)
    return nome


def remover(professor_id, turma_id):
    """Exclui a turma. Os alunos dela saem da turma (voltam a entrar com um novo codigo)."""
    turma_id = _id(turma_id, "Turma não encontrada.")
    with db.transacao() as cursor:
        cursor.execute(
            "select id, nome from public.turmas where id = %s and professor_id = %s for update",
            (turma_id, int(professor_id)),
        )
        turma = cursor.fetchone()
        if not turma:
            raise ErroTurma("Turma não encontrada.", 404)
        cursor.execute(
            """
            update public.usuarios
               set professor_id = null, turma_id = null, turma = null, sala_entrada_em = null
             where turma_id = %s and perfil = %s
            """,
            (turma_id, PERFIL_ALUNO),
        )
        alunos = cursor.rowcount
        cursor.execute("delete from public.turmas where id = %s", (turma_id,))
    return {"nome": turma["nome"], "alunos": alunos}


def gerar_codigo(professor_id, turma_id):
    """Novo codigo RBT-XXXX para a turma (o anterior deixa de valer)."""
    turma_id = _id(turma_id, "Turma não encontrada.")
    validade = datetime.now(timezone.utc) + VALIDADE_DO_CODIGO

    for _ in range(8):
        codigo = "RBT-" + "".join(secrets.choice(LETRAS_DO_CODIGO) for _ in range(4))
        try:
            with db.transacao() as cursor:
                cursor.execute(
                    """
                    update public.turmas
                       set codigo = %s, codigo_validade = %s
                     where id = %s and professor_id = %s
                    returning nome
                    """,
                    (codigo, validade, turma_id, int(professor_id)),
                )
                linha = cursor.fetchone()
        except psycopg.errors.UniqueViolation:
            continue  # o sorteio repetiu o codigo de outra turma: sorteia de novo
        if not linha:
            raise ErroTurma("Turma não encontrada.", 404)
        return {"codigo": codigo, "validade": validade.isoformat(), "turma": linha["nome"]}

    raise ErroTurma("Não foi possível gerar um código agora. Tente de novo.", 503)


# ---------------------------------------------------------------------------
# Alunos
# ---------------------------------------------------------------------------

def entrar(aluno_id, turma):
    """Coloca o aluno na turma (sai da turma em que estava antes)."""
    with db.transacao() as cursor:
        cursor.execute(
            """
            update public.usuarios
               set professor_id = %s, turma_id = %s, turma = %s, sala_entrada_em = now()
             where id = %s and perfil = %s
            """,
            (int(turma["professor_id"]), int(turma["id"]), turma["nome"], int(aluno_id), PERFIL_ALUNO),
        )


def _aluno_da_professora(cursor, professor_id, aluno_id):
    aluno_id = _id(aluno_id, "Aluno não encontrado nas suas turmas.")
    cursor.execute(
        """
        select id, nome, turma_id
          from public.usuarios
         where id = %s and perfil = %s and professor_id = %s
           for update
        """,
        (aluno_id, PERFIL_ALUNO, int(professor_id)),
    )
    aluno = cursor.fetchone()
    if not aluno:
        raise ErroTurma("Aluno não encontrado nas suas turmas.", 404)
    return aluno


def mover_aluno(professor_id, aluno_id, turma_id):
    turma_id = _id(turma_id, "Turma não encontrada.")
    with db.transacao() as cursor:
        aluno = _aluno_da_professora(cursor, professor_id, aluno_id)
        cursor.execute(
            "select id, nome from public.turmas where id = %s and professor_id = %s",
            (turma_id, int(professor_id)),
        )
        turma = cursor.fetchone()
        if not turma:
            raise ErroTurma("Turma não encontrada.", 404)
        cursor.execute(
            "update public.usuarios set turma_id = %s, turma = %s where id = %s",
            (turma["id"], turma["nome"], aluno["id"]),
        )
    return {"aluno": aluno["nome"], "turma": turma["nome"]}


def tirar_da_turma(professor_id, aluno_id):
    """O aluno sai da turma, mas continua com a conta e o progresso."""
    with db.transacao() as cursor:
        aluno = _aluno_da_professora(cursor, professor_id, aluno_id)
        cursor.execute(
            """
            update public.usuarios
               set professor_id = null, turma_id = null, turma = null, sala_entrada_em = null
             where id = %s
            """,
            (aluno["id"],),
        )
    return aluno["nome"]


def excluir_aluno(professor_id, aluno_id):
    """Apaga a conta do aluno e todo o progresso dele (nao da para desfazer)."""
    with db.transacao() as cursor:
        aluno = _aluno_da_professora(cursor, professor_id, aluno_id)
        cursor.execute("delete from public.usuarios where id = %s and perfil = %s", (aluno["id"], PERFIL_ALUNO))
    return aluno["nome"]
