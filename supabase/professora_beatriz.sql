-- =========================================================================
-- Login da professora Beatriz (único acesso ao painel do professor)
--
-- Rode depois de schema.sql. Todos os outros cadastros feitos pelo site
-- entram como ALUNO, e o índice "usuarios_um_professor" impede que exista
-- um segundo professor no banco.
--
-- E-mail: beatriz@robooteam.com
-- A senha inicial foi entregue junto com este arquivo (o banco guarda só o
-- hash). Para trocar a senha, gere um hash novo com:
--
--   python -c "from werkzeug.security import generate_password_hash as h; print(h('NOVA_SENHA'))"
--
-- e rode:  update public.usuarios set senha_hash = '<hash>' where perfil = 'PROFESSOR';
-- =========================================================================

insert into public.usuarios (nome, email, senha_hash, perfil, disciplina, turma_nome)
values (
    'Beatriz',
    'beatriz@robooteam.com',
    'scrypt:32768:8:1$xzJMK3CzXmLZWbn6$14193820b320ae4e5110a471c6b3bd37b50fea607a7017bfd0c26be22f1cbd5048e7c3102213de554d3faeee0abb727d554d5b80594253ca1236d06f02cef605',
    'PROFESSOR',
    'Inteligência Artificial e Robótica',
    'Turma da Beatriz'
)
on conflict (email) do nothing;
