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
- **Professor:** criar e editar etapas, escolher perguntas e minijogos, organizar a trilha e acompanhar os alunos da sala.
- **Atividades:** leituras, quizzes com explicações, jogo da memória, labirinto, caça-palavras, cobrinha e ligação de blocos.
- **Jogo de programação:** resolver fases usando comandos de movimento do robô.
- **Salas:** vincular alunos a um professor por meio de um código.

## Tecnologias

- Python e Flask no servidor.
- Templates Jinja2, HTML, CSS e JavaScript na interface.
- Arquivos JSON para os dados locais de usuários, progresso e trilhas personalizadas.
- Werkzeug para hashes de senhas e ItsDangerous para os tokens de acesso locais.
- Arquivos JSON para demonstração sem banco de dados externo.

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

3. Defina uma chave local para assinar as sessões no arquivo `.env`. Se ele já existir, adicione ou atualize apenas esta variável:

   ```dotenv
   SECRET_KEY=substitua-por-uma-chave-aleatoria
   ```

4. Inicie a aplicação:

   ```powershell
   .\.venv\Scripts\python.exe app.py
   ```

5. Abra `http://127.0.0.1:5000` no navegador.

A página deve ser aberta pelo servidor Flask, pois usa expressões Jinja2 para gerar os endereços dos arquivos e das rotas. A execução por `app.py` habilita o modo de depuração para desenvolvimento local.

## Primeiro acesso

Na página inicial, selecione **Cadastre-se**, crie um perfil de aluno ou professor e entre pelo login. O cadastro local exige nome com pelo menos três caracteres e senha com pelo menos oito caracteres.

Para explorar as salas, crie um perfil de professor e utilize o código da sala para vincular um perfil de aluno. Alunos sem sala utilizam a trilha padrão; alunos vinculados acessam a trilha do professor.

## Estrutura dos arquivos

```text
RobooTeam/
├── app.py                  # Aplicação Flask, páginas e APIs
├── jogo_conteudo.py         # Fases e regras do jogo de programação
├── trilha_conteudo.py       # Conteúdo padrão das trilhas e minijogos
├── trilha_store.py          # Persistência das trilhas personalizadas
├── usuarios_teste.json     # Usuários e progresso do modo local
├── templates/              # Páginas HTML renderizadas pelo Flask
│   ├── index.html          # Apresentação do projeto
│   ├── login.html          # Login e cadastro
│   ├── aluno.html          # Área do aluno
│   ├── professor.html      # Área do professor
│   ├── trilha_aula.html    # Conteúdo de uma etapa
│   └── jogo_blocos.html    # Jogo de programação
└── static/                 # Estilos, scripts e imagens
```

O arquivo `trilha_atividades.json` é gerado ao salvar trilhas personalizadas. O arquivo `.env` contém configurações locais.

## Hospedagem na Vercel

O projeto possui `vercel.json`, `requirements.txt` e `.python-version`. Ao importar o repositório na Vercel, mantenha o diretório raiz como a pasta do projeto e não configure comandos personalizados de build ou de saída.

Cadastre uma variável de ambiente chamada `SECRET_KEY` nas configurações do projeto. Gere um valor longo e aleatório e use o mesmo valor nos ambientes de produção e preview nos quais as sessões devam continuar válidas.

Na Vercel, os arquivos JSON são copiados para `/tmp`, o único diretório gravável das Functions. Isso permite demonstrar cadastros e progresso sem erros de escrita, mas os dados são temporários e podem desaparecer quando uma instância for reiniciada ou substituída. Para persistência real, conecte posteriormente um banco de dados.
