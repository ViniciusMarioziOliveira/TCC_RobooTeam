TIMELINE = [
    {
        "id": 1,
        "period": "1940 a 1959",
        "title": "Fundamentos e nascimento",
        "description": "As ideias, pesquisas e primeiros computadores preparam o nascimento da inteligência artificial.",
        "color": "mint",
        "completed": False,
    },
    {
        "id": 2,
        "period": "1960 a 1999",
        "title": "Primeiros avanços e invernos da IA",
        "description": "A IA evolui com sistemas especialistas, mas enfrenta períodos de grande expectativa e poucos recursos.",
        "color": "blue",
        "completed": False,
    },
    {
        "id": 3,
        "period": "2000 a 2019",
        "title": "Era dos dados e aprendizado profundo",
        "description": "Mais dados e maior poder computacional impulsionam o aprendizado de máquina e as redes neurais.",
        "color": "coral",
        "completed": False,
    },
    {
        "id": 4,
        "period": "2020 até o presente",
        "title": "A era da IA generativa",
        "description": "Modelos generativos passam a criar textos, imagens e ideias, transformando a relação das pessoas com a tecnologia.",
        "color": "yellow",
        "completed": False,
    },
    {
        "id": 5,
        "period": "Próximos capítulos",
        "title": "O futuro da inteligência artificial",
        "description": "Novas possibilidades surgem junto com a responsabilidade de criar uma tecnologia mais segura, justa e humana.",
        "color": "purple",
        "completed": False,
    },
]

LESSONS = {
    1: {
        "eyebrow": "Fundamentos e nascimento",
        "title": "As perguntas que deram origem à IA",
        "intro": "Entre 1940 e 1959, pesquisadores começaram a investigar se máquinas poderiam resolver problemas e simular formas de raciocínio.",
        "sections": [
            {"title": "O começo da ideia", "text": "O avanço dos computadores tornou possível imaginar máquinas capazes de seguir instruções, calcular possibilidades e tomar decisões simples."},
            {"title": "Um marco importante", "text": "Em 1950, Alan Turing propôs uma forma de discutir se uma máquina poderia demonstrar comportamento inteligente. Em 1956, o termo inteligência artificial ganhou força em um encontro de pesquisadores em Dartmouth."},
        ],
        "quiz": [
            {"question": "Em que década o termo inteligência artificial ganhou força como área de pesquisa?", "options": ["Na década de 1950", "Na década de 1970", "Na década de 1990"], "answer": 0},
            {"question": "Qual pergunta Alan Turing ajudou a colocar em debate?", "options": ["Se máquinas poderiam demonstrar comportamento inteligente", "Se computadores deveriam ter telas coloridas", "Se a internet seria gratuita"], "answer": 0},
            {"question": "Onde aconteceu o encontro que ajudou a consolidar o termo inteligência artificial?", "options": ["Dartmouth", "Silicon Valley", "Londres"], "answer": 0},
            {"question": "O que ajudou a criar as primeiras pesquisas em IA?", "options": ["O avanço dos computadores", "A popularização dos smartphones", "As redes sociais"], "answer": 0},
        ],
    },
    2: {
        "eyebrow": "Primeiros avanços e invernos da IA",
        "title": "Quando as expectativas encontraram limites",
        "intro": "De 1960 a 1999, a IA avançou com sistemas especialistas, mas também passou por períodos em que o financiamento e o entusiasmo diminuíram.",
        "sections": [
            {"title": "Sistemas especialistas", "text": "Esses programas usavam regras criadas por especialistas para resolver problemas em áreas específicas, como diagnósticos e configurações técnicas."},
            {"title": "Os invernos da IA", "text": "Quando os resultados demoraram mais do que o esperado, investimentos foram reduzidos. Esses períodos ensinaram que pesquisa científica precisa de metas realistas e avaliação cuidadosa."},
        ],
        "quiz": [
            {"question": "O que caracterizou os chamados invernos da IA?", "options": ["A criação dos primeiros computadores pessoais", "A redução de investimentos e expectativas na pesquisa", "O surgimento das redes sociais"], "answer": 1},
            {"question": "Como funcionavam os sistemas especialistas?", "options": ["Usavam regras criadas por especialistas", "Aprendiam sem receber nenhum dado", "Funcionavam apenas com imagens"], "answer": 0},
            {"question": "Por que os investimentos em IA diminuíram em alguns períodos?", "options": ["Os resultados demoraram mais que o esperado", "Os computadores deixaram de existir", "A internet foi desligada"], "answer": 0},
            {"question": "O que os invernos da IA ensinaram aos pesquisadores?", "options": ["A importância de metas realistas", "Que dados não são necessários", "Que toda previsão está correta"], "answer": 0},
        ],
    },
    3: {
        "eyebrow": "Era dos dados e aprendizado profundo",
        "title": "Máquinas aprendendo com exemplos",
        "intro": "Entre 2000 e 2019, a combinação de grandes conjuntos de dados, processadores mais rápidos e novas técnicas mudou a escala da IA.",
        "sections": [
            {"title": "Aprendizado de máquina", "text": "Em vez de receber todas as regras prontas, um sistema pode encontrar padrões em exemplos. A qualidade dos dados passa a ser parte essencial do resultado."},
            {"title": "Redes neurais profundas", "text": "Camadas de redes neurais conseguem aprender representações complexas. Isso trouxe avanços em visão computacional, reconhecimento de voz e tradução."},
        ],
        "quiz": [
            {"question": "O que alimenta um sistema de aprendizado de máquina?", "options": ["Apenas regras fixas escritas manualmente", "Exemplos e dados usados para encontrar padrões", "Somente comandos de voz"], "answer": 1},
            {"question": "O que a qualidade dos dados influencia?", "options": ["A qualidade dos resultados do sistema", "A cor do computador", "O tamanho da tela"], "answer": 0},
            {"question": "O que são redes neurais profundas?", "options": ["Redes com camadas que aprendem representações complexas", "Cabos usados para conectar computadores", "Listas de regras sem exemplos"], "answer": 0},
            {"question": "Em qual área a IA teve avanços nesse período?", "options": ["Reconhecimento de voz", "Somente impressão em papel", "Apenas cálculos manuais"], "answer": 0},
        ],
    },
    4: {
        "eyebrow": "A era da IA generativa",
        "title": "Modelos que criam novos conteúdos",
        "intro": "A partir de 2020, modelos generativos passaram a produzir textos, imagens, áudios e códigos a partir de instruções humanas.",
        "sections": [
            {"title": "Como ela cria", "text": "Durante o treinamento, o modelo aprende relações presentes em muitos exemplos. Depois, gera uma resposta calculando quais possibilidades combinam melhor com o contexto recebido."},
            {"title": "Uso responsável", "text": "Uma resposta criada por IA precisa ser conferida. Conhecer suas limitações, proteger dados pessoais e citar fontes são atitudes importantes para usar essa tecnologia."},
        ],
        "quiz": [
            {"question": "Qual atitude é importante ao usar uma IA generativa?", "options": ["Aceitar qualquer resposta sem conferir", "Compartilhar dados pessoais para melhorar o resultado", "Verificar as informações e considerar as limitações do modelo"], "answer": 2},
            {"question": "O que modelos generativos podem produzir?", "options": ["Textos, imagens, áudios e códigos", "Somente números aleatórios", "Apenas arquivos físicos"], "answer": 0},
            {"question": "Como um modelo generativo aprende relações?", "options": ["Durante o treinamento com muitos exemplos", "Apenas lendo uma pergunta", "Sem receber nenhum dado"], "answer": 0},
            {"question": "Por que é importante verificar uma resposta de IA?", "options": ["Porque o modelo pode cometer erros", "Porque a resposta sempre vem em outro idioma", "Porque o modelo não consegue gerar texto"], "answer": 0},
        ],
    },
    5: {
        "eyebrow": "Próximos capítulos",
        "title": "Criar o futuro com responsabilidade",
        "intro": "O próximo capítulo da IA depende de escolhas humanas: pesquisar com cuidado, reduzir riscos e garantir que a tecnologia beneficie diferentes pessoas.",
        "sections": [
            {"title": "Tecnologia e sociedade", "text": "A IA pode apoiar a educação, a ciência, a saúde e a criatividade. Para isso, as decisões sobre seu desenvolvimento precisam considerar diferentes realidades e necessidades."},
            {"title": "Responsabilidade compartilhada", "text": "Desenvolvedores, instituições e usuários devem avaliar resultados, proteger dados, combater vieses e manter pessoas capazes de questionar as respostas dos sistemas."},
        ],
        "quiz": [
            {"question": "O que deve orientar o desenvolvimento da IA no futuro?", "options": ["Somente a velocidade de lançamento", "Escolhas responsáveis e benefícios para a sociedade", "A retirada das pessoas das decisões"], "answer": 1},
            {"question": "Quem participa da responsabilidade pelo uso da IA?", "options": ["Apenas o computador", "Somente uma empresa", "Desenvolvedores, instituições e usuários"], "answer": 2},
            {"question": "Por que é importante combater vieses nos sistemas?", "options": ["Para tornar os resultados mais justos", "Para deixar os sistemas mais lentos", "Para evitar o uso de dados"], "answer": 0},
            {"question": "Qual atitude ajuda a usar a IA de forma consciente?", "options": ["Questionar e verificar as respostas", "Aceitar toda resposta automaticamente", "Ignorar os impactos nas pessoas"], "answer": 0},
        ],
    },
}
