# RobooTeam

RobooTeam é um projeto educacional em desenvolvimento que apresenta a robótica e a programação por meio de atividades práticas, trilhas de aprendizado, quizzes e minijogos. A proposta é estimular a curiosidade, o raciocínio lógico e a colaboração entre alunos e professores.

## Página inicial

A página `templates/index.html` apresenta o projeto e oferece acesso ao cadastro e ao login. Ela reúne:

- Apresentação da RobooTeam e dos benefícios do aprendizado na prática.
- Demonstração visual de uma missão de robótica com programação em blocos.
- Jornada de aprendizado: descoberta, construção e resultados.
- Apresentação das trilhas, dos minijogos e do painel do professor.
- Rodapé com as áreas **Aluno**, **Professor** e **Atividades**.

A demonstração da página inicial é uma interface ilustrativa; não representa uma conexão com um robô físico.

## Funcionalidades do projeto

- **Aluno:** acessar a trilha, estudar conteúdos, responder quizzes, realizar minijogos e acompanhar o progresso.
- **Professor:** criar e editar etapas (com imagens nos blocos de leitura), escolher perguntas e minijogos, organizar a trilha e acompanhar os alunos da sala.
- **Atividades:** leituras, quizzes com explicações, jogo da memória, labirinto, caça-palavras, cobrinha e ligação de blocos.
- **Jogo de programação:** resolver fases usando comandos de movimento do robô.
- **Salas:** vincular alunos a um professor por meio de um código.
- **Arena RobooTeam:** partidas em equipe com mapa desenhado pelo professor, ranking e pedidos de ajuda ao vivo.

## Tecnologias

- Python e Flask no servidor.
- Templates Jinja2, HTML, CSS e JavaScript na interface.
- Banco de dados PostgreSQL no Supabase (região São Paulo, `sa-east-1`) para usuários, progresso, trilhas e arenas.
- Supabase Storage para as imagens anexadas às trilhas.
- Werkzeug para hashes de senhas e ItsDangerous para os tokens de acesso.

## Banco de dados (Supabase)

As tabelas ficam em `supabase/schema.sql`:

| Tabela | Conteúdo |
| --- | --- |
| `usuarios` | Alunos e a professora (cadastro e login) |
| `progresso_trilha` | Etapas da trilha concluídas por aluno |
| `progresso_jogo` | Fases do jogo de programação concluídas |
| `trilha_atividades` | Trilha personalizada da professora |
| `arenas`, `arena_equipes`, `arena_jogadores` | Partidas da Arena, equipes e jogadores |

O RLS fica ativo em todas as tabelas e sem políticas: só o servidor Flask, conectado pela string do banco, lê e grava os dados. As chaves públicas da API do Supabase não acessam nada.

### Criar o projeto

1. Em [supabase.com/dashboard](https://supabase.com/dashboard), crie um projeto novo e escolha a região **South America (São Paulo)**. Guarde a senha do banco.
2. Abra **SQL Editor**, cole o conteúdo de `supabase/schema.sql` e execute. Depois faça o mesmo com `supabase/professora_beatriz.sql`.
3. Em **Connect**, copie a string do **Transaction pooler** (porta 6543) e troque `[YOUR-PASSWORD]` pela senha do banco.
4. Em **Project Settings → API Keys**, copie a URL do projeto e uma **secret key** (usada para guardar as imagens das trilhas).

### Professora e alunos

Existe um único login de professor: **Beatriz** (`beatriz@robooteam.com`), criado direto no banco por `supabase/professora_beatriz.sql`. O banco impede que exista um segundo professor, e todo cadastro feito pelo site é de aluno. As instruções para trocar a senha da professora estão no próprio arquivo SQL.

## Como executar localmente

É necessário ter Python instalado e disponível no terminal. Execute os comandos abaixo na pasta do projeto, usando PowerShell no Windows.

1. Crie um ambiente virtual:

   ```powershell
   py -m venv .venv
   ```

2. Instale as dependências usadas pelo código:

   ```powershell
   .\.venv\Scripts\python.exe -m pip install -r requirements.txt
   ```

   As dependências e versões usadas na hospedagem estão em `requirements.txt`.

3. Copie `.env.example` para `.env` e preencha com os dados do Supabase:

   ```dotenv
   SECRET_KEY=substitua-por-uma-chave-aleatoria
   DATABASE_URL=postgresql://postgres.SEU_PROJETO:SUA_SENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
   SUPABASE_URL=https://SEU_PROJETO.supabase.co
   SUPABASE_SECRET_KEY=sb_secret_...
   ```

4. Inicie a aplicação:

   ```powershell
   .\.venv\Scripts\python.exe app.py
   ```

5. Abra `http://127.0.0.1:5000` no navegador.

A página deve ser aberta pelo servidor Flask, pois usa expressões Jinja2 para gerar os endereços dos arquivos e das rotas. A execução por `app.py` habilita o modo de depuração para desenvolvimento local.

## Primeiro acesso

Na página inicial, selecione **Cadastre-se**, crie uma conta de aluno e entre pelo login. O cadastro exige nome com pelo menos três caracteres e senha com pelo menos oito caracteres.

Para explorar as salas, entre como a professora Beatriz, gere o código da sala e use-o no painel de um aluno. Alunos sem sala utilizam a trilha padrão; alunos vinculados acessam a trilha da professora.

## Estrutura dos arquivos

```text
RobooTeam/
├── app.py                  # Aplicação Flask, páginas e APIs
├── db.py                   # Conexão com o banco do Supabase
├── usuarios_store.py       # Usuários, login e progresso dos alunos
├── trilha_store.py         # Trilhas personalizadas da professora
├── arena_store.py          # Partidas da Arena RobooTeam
├── armazenamento.py        # Imagens das trilhas no Supabase Storage
├── jogo_conteudo.py        # Fases e regras do jogo de programação
├── trilha_conteudo.py      # Conteúdo padrão das trilhas e minijogos
├── supabase/
│   ├── schema.sql          # Tabelas, segurança e bucket de imagens
│   └── professora_beatriz.sql  # Login da professora
├── templates/              # Páginas HTML renderizadas pelo Flask
│   ├── index.html          # Apresentação do projeto
│   ├── login.html          # Login e cadastro
│   ├── aluno.html          # Área do aluno
│   ├── professor.html      # Área do professor
│   ├── trilha_aula.html    # Conteúdo de uma etapa
│   ├── jogo_blocos.html    # Jogo de programação
│   └── arena.html          # Arena RobooTeam
├── public/
│   └── static/             # Estilos, scripts e imagens (servidos em /static)
├── vercel.json             # Configuração da hospedagem na Vercel
├── requirements.txt        # Dependências Python
└── .python-version         # Versão do Python usada na Vercel (3.12)
```

O arquivo `.env` contém as configurações locais e não vai para o repositório.

Os arquivos estáticos ficam em `public/static/` porque, na Vercel, tudo o que está em `public/` é entregue direto pela CDN, sem passar pelo Flask. Localmente, o Flask serve a mesma pasta no mesmo endereço (`/static/...`), então os templates continuam usando `url_for('static', ...)` normalmente.

## Hospedagem na Vercel

O projeto já está pronto para a Vercel:

- `vercel.json` usa o preset **Flask**, coloca a função na região de São Paulo (`gru1`, perto do banco) e deixa `public/` e `supabase/` fora do pacote da função.
- `requirements.txt` e `.python-version` definem as dependências e o Python 3.12.
- `.vercelignore` impede que `.env`, `.venv` e arquivos locais sejam enviados.
- Na Vercel, o app não inicia sem `SECRET_KEY`. Isso evita que ele rode com a chave de testes que está no código.

### Passo a passo

1. **Envie todo o código para o GitHub.** Os arquivos novos (`db.py`, `usuarios_store.py`, `arena_store.py`, `armazenamento.py`, `public/`, `supabase/` etc.) precisam estar no repositório, senão o deploy quebra:

   ```powershell
   git add -A
   git commit -m "Prepara o projeto para a Vercel"
   git push
   ```

   Confira no GitHub se `.env` **não** aparece na lista de arquivos.

2. **Gere uma chave secreta** para a produção:

   ```powershell
   .\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_hex(32))"
   ```

3. **Importe o projeto.** Em [vercel.com/new](https://vercel.com/new), escolha o repositório `TCC_RobooTeam`. Confira se:
   - **Framework Preset** está como **Flask** (é detectado sozinho);
   - **Root Directory** está como `./`;
   - **Build Command**, **Output Directory** e **Install Command** estão vazios ou com o padrão (não sobrescreva).

4. **Cadastre as Environment Variables** (ainda na tela de importação, ou depois em **Settings → Environment Variables**), marcando **Production** e **Preview**:

   | Nome | Valor |
   | --- | --- |
   | `SECRET_KEY` | A chave gerada no passo 2 |
   | `DATABASE_URL` | Supabase → **Connect** → **Transaction pooler** (porta **6543**), com `[YOUR-PASSWORD]` trocado pela senha do banco |
   | `SUPABASE_URL` | `https://SEU_PROJETO.supabase.co` |
   | `SUPABASE_SECRET_KEY` | Supabase → **Project Settings → API Keys** → secret key (`sb_secret_...`) |

   Cole os valores sem aspas. Se a senha do banco tiver caracteres como `@`, `#`, `/` ou `%`, eles precisam ser codificados na URL (por exemplo, `@` vira `%40`). Ou troque a senha no Supabase por uma só com letras e números.

5. **Clique em Deploy** e aguarde a URL (`https://...vercel.app`).

6. **Teste o site publicado:**
   - entre como a professora Beatriz e gere um código de sala;
   - cadastre um aluno em outra janela anônima e entre na sala com o código;
   - no painel da professora, edite uma etapa e envie uma imagem (testa o Supabase Storage).

### Depois do primeiro deploy

- Cada `git push` na branch `main` publica uma nova versão automaticamente.
- Alterou uma Environment Variable? Ela só vale para deploys novos: abra **Deployments**, clique nos três pontos do último deploy e escolha **Redeploy**.
- Trocar a `SECRET_KEY` desconecta todos os usuários (eles só precisam entrar de novo).

### Se algo der errado

Os erros aparecem em **Deployments → (deploy) → Logs** na Vercel.

| Sintoma | Causa provável |
| --- | --- |
| Erro 500 em todas as páginas e o log mostra `Defina SECRET_KEY...` | `SECRET_KEY` não cadastrada (ou cadastrada só em outro ambiente) |
| "Não foi possível acessar o banco de dados agora" | `DATABASE_URL` errada: confira se é a do **Transaction pooler** (porta 6543) e se a senha foi trocada |
| "O envio de imagens ainda não foi configurado no servidor" | Faltou `SUPABASE_URL` ou `SUPABASE_SECRET_KEY` |
| Página sem estilo ou sem imagens | A pasta `public/` não foi enviada ao GitHub |
