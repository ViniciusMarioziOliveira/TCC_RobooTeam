# -*- coding: utf-8 -*-
"""Usuarios (alunos e a professora) e o progresso dos alunos no Supabase.

Os dados ficam nas tabelas ``usuarios``, ``progresso_trilha`` e
``progresso_jogo`` (veja ``supabase/schema.sql``). As funcoes devolvem
dicionarios no mesmo formato que o resto do app ja usava: listas de etapas
concluidas, pontuacoes por id e datas em texto ISO.
"""

from datetime import datetime

import psycopg

import db

PERFIL_ALUNO = "ALUNO"
PERFIL_PROFESSOR = "PROFESSOR"


class EmailJaCadastrado(ValueError):
    """Ja existe uma conta com o e-mail informado."""


_SELECT_USUARIO = """
    select u.id, u.nome, u.email, u.senha_hash, u.perfil, u.disciplina,
           u.turma_nome, u.codigo_sala, u.codigo_validade,
           u.professor_id, u.turma, u.sala_entrada_em,
           coalesce(t.etapas, '{}') as etapas_concluidas,
           coalesce(t.pontuacoes, '{}'::jsonb) as pontuacoes,
           t.atualizado_em as progresso_atualizado_em,
           coalesce(j.fases, '{}') as fases_jogo_concluidas,
           coalesce(j.pontuacoes, '{}'::jsonb) as pontuacoes_jogo,
           j.atualizado_em as jogo_atualizado_em
      from public.usuarios u
      left join lateral (
            select array_agg(p.etapa_id order by p.etapa_id) as etapas,
                   jsonb_object_agg(p.etapa_id::text, p.acertos) as pontuacoes,
                   max(p.atualizada_em) as atualizado_em
              from public.progresso_trilha p
             where p.aluno_id = u.id
      ) t on true
      left join lateral (
            select array_agg(p.fase_id order by p.fase_id) as fases,
                   jsonb_object_agg(p.fase_id::text, p.melhor_pontuacao) as pontuacoes,
                   max(p.atualizada_em) as atualizado_em
              from public.progresso_jogo p
             where p.aluno_id = u.id
      ) j on true
"""


def _formatar(linha):
    """Converte as datas para texto ISO, como o app guardava antes."""
    if not linha:
        return None
    return {
        chave: valor.isoformat() if isinstance(valor, datetime) else valor
        for chave, valor in linha.items()
    }


def _buscar(filtro, parametros):
    with db.transacao() as cursor:
        cursor.execute(f"{_SELECT_USUARIO} where {filtro}", parametros)
        return [_formatar(linha) for linha in cursor.fetchall()]


# ---------------------------------------------------------------------------
# Consultas
# ---------------------------------------------------------------------------

def buscar_por_id(usuario_id):
    try:
        usuario_id = int(usuario_id)
    except (TypeError, ValueError):
        return None
    encontrados = _buscar("u.id = %s", (usuario_id,))
    return encontrados[0] if encontrados else None


def buscar_por_email(email):
    encontrados = _buscar("u.email = %s", (str(email or "").strip().lower(),))
    return encontrados[0] if encontrados else None


def buscar_professor(professor_id):
    try:
        professor_id = int(professor_id)
    except (TypeError, ValueError):
        return None
    encontrados = _buscar("u.id = %s and u.perfil = %s", (professor_id, PERFIL_PROFESSOR))
    return encontrados[0] if encontrados else None


def buscar_professor_por_codigo(codigo):
    encontrados = _buscar(
        "upper(u.codigo_sala) = %s and u.perfil = %s",
        (str(codigo or "").strip().upper(), PERFIL_PROFESSOR),
    )
    return encontrados[0] if encontrados else None


def alunos_do_professor(professor_id):
    return _buscar(
        "u.professor_id = %s and u.perfil = %s order by u.nome",
        (int(professor_id), PERFIL_ALUNO),
    )


def contar_conclusoes_por_etapa(professor_id):
    """Quantos alunos da sala ja concluiram cada etapa."""
    with db.transacao() as cursor:
        cursor.execute(
            """
            select p.etapa_id, count(*) as total
              from public.progresso_trilha p
              join public.usuarios u on u.id = p.aluno_id
             where u.professor_id = %s and u.perfil = %s
             group by p.etapa_id
            """,
            (int(professor_id), PERFIL_ALUNO),
        )
        return {linha["etapa_id"]: linha["total"] for linha in cursor.fetchall()}


# ---------------------------------------------------------------------------
# Escrita
# ---------------------------------------------------------------------------

def criar_aluno(nome, email, senha_hash):
    """Todo cadastro feito pelo site e de aluno. A professora e criada no banco."""
    try:
        with db.transacao() as cursor:
            cursor.execute(
                """
                insert into public.usuarios (nome, email, senha_hash, perfil)
                values (%s, %s, %s, %s)
                returning id
                """,
                (nome, email, senha_hash, PERFIL_ALUNO),
            )
            return cursor.fetchone()["id"]
    except psycopg.errors.UniqueViolation:
        raise EmailJaCadastrado("Já existe uma conta com este e-mail")


def registrar_etapa_concluida(aluno_id, etapa_id, acertos):
    with db.transacao() as cursor:
        cursor.execute(
            """
            insert into public.progresso_trilha (aluno_id, etapa_id, acertos)
            values (%s, %s, %s)
            on conflict (aluno_id, etapa_id) do update
               set acertos = excluded.acertos,
                   atualizada_em = now()
            """,
            (int(aluno_id), int(etapa_id), int(acertos)),
        )


def salvar_fase_jogo(aluno_id, fase_id, melhor_pontuacao):
    with db.transacao() as cursor:
        cursor.execute(
            """
            insert into public.progresso_jogo (aluno_id, fase_id, melhor_pontuacao)
            values (%s, %s, %s)
            on conflict (aluno_id, fase_id) do update
               set melhor_pontuacao = excluded.melhor_pontuacao,
                   atualizada_em = now()
            """,
            (int(aluno_id), int(fase_id), int(melhor_pontuacao)),
        )


def vincular_aluno_a_sala(aluno_id, professor_id, nome_turma):
    with db.transacao() as cursor:
        cursor.execute(
            "update public.usuarios set turma_nome = %s where id = %s and turma_nome is null",
            (nome_turma, int(professor_id)),
        )
        cursor.execute(
            """
            update public.usuarios
               set professor_id = %s, turma = %s, sala_entrada_em = now()
             where id = %s and perfil = %s
            """,
            (int(professor_id), nome_turma, int(aluno_id), PERFIL_ALUNO),
        )


def salvar_codigo_sala(professor_id, codigo, validade, nome_turma):
    with db.transacao() as cursor:
        cursor.execute(
            """
            update public.usuarios
               set codigo_sala = %s,
                   codigo_validade = %s,
                   turma_nome = coalesce(turma_nome, %s)
             where id = %s and perfil = %s
            returning turma_nome
            """,
            (codigo, validade, nome_turma, int(professor_id), PERFIL_PROFESSOR),
        )
        linha = cursor.fetchone()
        return linha["turma_nome"] if linha else nome_turma
