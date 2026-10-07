# -*- coding: utf-8 -*-
"""Conexao com o banco PostgreSQL do Supabase.

A string de conexao vem da variavel ``DATABASE_URL``. Use a do *Transaction
pooler* do Supabase (porta 6543), que funciona em IPv4 e combina com a
Vercel. As conexoes ficam em um pool pequeno e cada operacao roda dentro de
``transacao()``: tudo e confirmado no fim do bloco ou desfeito se der erro.
"""

import atexit
import os
import threading
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool, PoolTimeout


class BancoNaoConfigurado(RuntimeError):
    """A variavel DATABASE_URL nao foi definida."""


# Erros que significam "o banco nao respondeu como deveria".
ERROS_DE_BANCO = (psycopg.Error, PoolTimeout, BancoNaoConfigurado)

_pool = None
_lock = threading.Lock()


def _criar_pool():
    url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
    if not url:
        raise BancoNaoConfigurado(
            "Defina DATABASE_URL com a string de conexão do Supabase (arquivo .env)."
        )

    return ConnectionPool(
        url,
        min_size=1,
        max_size=int(os.getenv("DB_POOL_MAX", "5")),
        # prepare_threshold=None: o pooler do Supabase (modo transacao) nao
        # aceita prepared statements reaproveitados entre conexoes.
        kwargs={"row_factory": dict_row, "prepare_threshold": None, "connect_timeout": 10},
        # Descarta conexoes que cairam enquanto a funcao da Vercel dormia.
        check=ConnectionPool.check_connection,
        timeout=15,
        open=True,
        name="robooteam",
    )


def _obter_pool():
    global _pool
    if _pool is None:
        with _lock:
            if _pool is None:
                _pool = _criar_pool()
                # fecha as conexoes ao sair (evita travar o reload do Flask)
                atexit.register(_pool.close, timeout=1)
    return _pool


@contextmanager
def transacao():
    """Cursor dentro de uma transacao (commit ao sair, rollback se houver erro)."""
    with _obter_pool().connection() as conexao:
        with conexao.cursor() as cursor:
            yield cursor
