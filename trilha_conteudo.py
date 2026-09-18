# -*- coding: utf-8 -*-
"""Conteudo padrao da trilha de Inteligencia Artificial do RobooTeam.

Cada item de ``ATIVIDADES_PADRAO`` une, em um unico registro, os dados que a
linha do tempo do aluno exibe (``period``, ``title``, ``description``, ``color``)
e os dados da aula em si (``eyebrow``, ``lesson_title``, ``intro``, ``sections``,
``quiz`` e ``minigame``). Esse formato unificado e o que o professor edita no
painel e o que ``trilha_store`` persiste em disco.

Tipos de minijogo suportados:

``memory``       Jogo da memoria com pares termo/significado.
``maze``         Labirinto do robo com 1 a 3 fases.
``word_search``  Caca-palavras (a grade e montada automaticamente no navegador).
``snake``        Jogo da cobrinha com meta de bolinhas.
``drag_drop``    Ligar blocos as explicacoes corretas.
``nenhum``       Etapa somente com leitura e quiz.
"""

CORES_DISPONIVEIS = ("mint", "blue", "coral", "yellow", "purple")

TIPOS_MINIJOGO = ("memory", "maze", "word_search", "snake", "drag_drop", "nenhum")

ROTULOS_MINIJOGO = {
    "memory": "Jogo da memória",
    "maze": "Labirinto do robô",
    "word_search": "Caça-palavras",
    "snake": "Jogo da cobrinha",
    "drag_drop": "Ligar os blocos",
    "nenhum": "Somente leitura e quiz",
}


ATIVIDADES_PADRAO = [
    {
        "id": 1,
        "period": "1940 a 1959",
        "title": "O começo dos robôs pensantes",
        "description": "Os primeiros computadores gigantes e os cientistas que inventaram o nome Inteligência Artificial.",
        "color": "mint",
        "eyebrow": "1940 a 1959 · Estação 1",
        "lesson_title": "O começo dos robôs e computadores pensantes",
        "intro": "Como cientistas e matemáticos começaram a sonhar com máquinas inteligentes e criaram os primeiros computadores do mundo!",
        "sections": [
            {
                "title": "Os primeiros computadores gigantes",
                "text": "Antigamente, nos anos 1940 e 1950, os primeiros computadores eram tão gigantescos que ocupavam salas inteiras! Eles usavam peças de vidro parecidas com lâmpadas (chamadas válvulas) para fazer contas de matemática bem difíceis e ajudar os cientistas.",
            },
            {
                "title": "Alan Turing e o teste do robô",
                "text": "Um matemático genial chamado Alan Turing inventou uma brincadeira famosa chamada Jogo da Imitação. A ideia era simples: se uma pessoa conversasse por mensagens com um computador sem vê-lo e achasse que estava falando com outro ser humano, o computador provava ser muito inteligente!",
            },
            {
                "title": "O nascimento do nome Inteligência Artificial",
                "text": "Em 1956, cientistas importantes se reuniram em uma faculdade chamada Dartmouth. Foi nesse encontro que eles inventaram o nome oficial: Inteligência Artificial (ou IA), para estudar como fazer máquinas pensarem e resolverem problemas.",
            },
            {
                "title": "Curiosidade: por que chamamos erro de bug?",
                "text": "Você sabia que a palavra bug significa inseto em inglês? Um dia, um computador antigo parou de funcionar porque uma mariposa de verdade entrou dentro das peças dele! Os cientistas tiraram a mariposa e disseram que estavam tirando o bug. Desde então, quando um jogo ou aplicativo falha, chamamos de bug!",
            },
        ],
        "quiz": [
            {
                "question": "Como eram os primeiros computadores nos anos 1940 e 1950?",
                "options": [
                    "Eram relógios de pulso bem pequenos",
                    "Eram enormes e ocupavam salas inteiras",
                    "Eram celulares que cabiam no bolso",
                ],
                "answer": 1,
                "justification": "Muito bem! Os primeiros computadores eram tão gigantes que precisavam de uma sala inteira só para eles.",
            },
            {
                "question": "O que Alan Turing propôs no seu famoso teste para saber se uma máquina é inteligente?",
                "options": [
                    "Ver se o computador consegue correr rápido no pátio",
                    "Ver se o computador aprende a cozinhar um almoço",
                    "Ver se o computador consegue conversar tão bem que parece um ser humano",
                ],
                "answer": 2,
                "justification": "Isso mesmo! Se o computador conversar tão bem que ninguém percebe a diferença para um humano, ele passou no Teste de Turing.",
            },
            {
                "question": "Onde nasceu oficialmente o nome Inteligência Artificial, em 1956?",
                "options": [
                    "No encontro de cientistas em Dartmouth",
                    "Na época das caravelas, em 1500",
                    "Quando inventaram o primeiro celular touchscreen",
                ],
                "answer": 0,
                "justification": "Perfeito! Foi na Conferência de Dartmouth, em 1956, que os cientistas criaram o nome Inteligência Artificial.",
            },
            {
                "question": "Por que até hoje chamamos um erro no computador ou videogame de bug?",
                "options": [
                    "Porque é o som que o teclado faz ao travar",
                    "Porque foi o nome inventado por um famoso jogador de videogame",
                    "Porque uma mariposa (inseto) entrou em um computador antigo e causou uma falha",
                ],
                "answer": 2,
                "justification": "Isso aí! Uma mariposa de verdade entrou no computador e virou uma das histórias mais divertidas da informática.",
            },
        ],
        "minigame": {
            "type": "memory",
            "title": "Memória dos pioneiros da IA",
            "instruction": "Vire as cartas e encontre o par de cada pioneiro com a sua descoberta!",
            "target_points": 60,
            "pairs": [
                {"id": "p1", "term": "Alan Turing", "match": "Criou o teste para ver se a máquina pensa"},
                {"id": "p2", "term": "Primeiros computadores", "match": "Eram gigantes e ocupavam salas inteiras"},
                {"id": "p3", "term": "Dartmouth (1956)", "match": "Encontro onde nasceu o nome Inteligência Artificial"},
                {"id": "p4", "term": "Origem do bug", "match": "Uma mariposa de verdade travou o computador"},
                {"id": "p5", "term": "Válvulas de vidro", "match": "Peças antigas parecidas com lâmpadas"},
                {"id": "p6", "term": "Jogo da Imitação", "match": "Conversar sem saber se é robô ou humano"},
            ],
        },
    },
    {
        "id": 2,
        "period": "1960 a 1999",
        "title": "Robôs de regras e xadrez",
        "description": "Os primeiros robôs de conversa e o computador que venceu o campeão mundial de xadrez.",
        "color": "blue",
        "eyebrow": "1960 a 1999 · Estação 2",
        "lesson_title": "Robôs de regras e jogos incríveis",
        "intro": "Como os computadores aprenderam a seguir regras do tipo Se... Então, conversaram pela primeira vez e até venceram campeões de xadrez!",
        "sections": [
            {
                "title": "Programas que seguiam regrinhas",
                "text": "Nos anos 1970 e 1980, os cientistas criaram programas cheios de regrinhas lógicas, como: SE estiver com febre, ENTÃO beba água e descanse. Eram os Sistemas Especialistas, que ajudavam médicos e engenheiros a resolver problemas usando regras preparadas por humanos.",
            },
            {
                "title": "ELIZA: a primeira robô de conversa",
                "text": "Em 1966, criaram um dos primeiros chatbots do mundo, chamado ELIZA. Ela parecia uma psicóloga e respondia às pessoas fazendo novas perguntas, como: Por que você se sente assim? As pessoas adoravam conversar com ela!",
            },
            {
                "title": "O Inverno da IA: quando faltou paciência",
                "text": "Naquela época, os computadores ainda eram lentos e não tinham muita memória. Como muitas promessas de robôs do futuro demoraram para acontecer, as pessoas desanimaram e os investimentos diminuíram por um tempo. Essa fase foi chamada de Inverno da IA.",
            },
            {
                "title": "Deep Blue: o computador campeão de xadrez",
                "text": "Em 1997, um supercomputador chamado Deep Blue fez história: ele jogou xadrez e venceu o campeão mundial humano Garry Kasparov! Ele calculava milhões de jogadas por segundo para escolher o melhor movimento no tabuleiro.",
            },
        ],
        "quiz": [
            {
                "question": "Como funcionavam os primeiros programas inteligentes chamados Sistemas Especialistas?",
                "options": [
                    "Eles adivinhavam o futuro usando uma bola de cristal",
                    "Eles seguiam regrinhas lógicas do tipo se acontecer isso, então faça aquilo",
                    "Eles funcionavam apenas com mágica, sem nenhuma instrução",
                ],
                "answer": 1,
                "justification": "Muito bem! Eles usavam regras organizadas por especialistas para tomar decisões acertadas.",
            },
            {
                "question": "Quem foi a ELIZA, criada em 1966?",
                "options": [
                    "Um dos primeiros programas de computador que conversava com as pessoas",
                    "Um videogame portátil com tela colorida",
                    "O primeiro carro elétrico voador",
                ],
                "answer": 0,
                "justification": "Isso mesmo! A ELIZA foi uma das primeiras avós dos robôs de conversa que usamos hoje.",
            },
            {
                "question": "O que foi o Inverno da IA na história da tecnologia?",
                "options": [
                    "Uma época em que nevou dentro dos gabinetes dos computadores",
                    "O lançamento de um jogo de patinação no gelo",
                    "Um período em que as pessoas desanimaram porque os computadores da época ainda eram lentos",
                ],
                "answer": 2,
                "justification": "Certinho! Como a tecnologia da época ainda era lenta para tarefas difíceis, os estudos ficaram mais devagar por alguns anos.",
            },
            {
                "question": "Qual jogo o supercomputador Deep Blue jogou para vencer o campeão mundial em 1997?",
                "options": ["Futebol de botão", "Xadrez", "Videogame de corrida"],
                "answer": 1,
                "justification": "Excelente! O Deep Blue venceu no xadrez calculando milhões de jogadas em poucos segundos.",
            },
        ],
        "minigame": {
            "type": "maze",
            "title": "Labirinto lógico: desafio das 3 fases",
            "instruction": "Guie o robô pelo labirinto, colete os circuitos de dados e alcance a saída verde nas 3 fases!",
            "total_levels": 3,
        },
    },
    {
        "id": 3,
        "period": "2000 a 2019",
        "title": "Computadores que aprendem",
        "description": "Como os computadores aprenderam a reconhecer fotos e vozes usando muitas imagens da internet.",
        "color": "coral",
        "eyebrow": "2000 a 2019 · Estação 3",
        "lesson_title": "Computadores que aprendem com exemplos",
        "intro": "Como a internet cheia de fotos e vídeos ensinou as máquinas a reconhecer vozes, rostos e objetos do dia a dia!",
        "sections": [
            {
                "title": "Aprendendo como a gente: Machine Learning",
                "text": "Em vez de escrever milhares de regras manuais, os cientistas descobriram um jeito incrível: mostrar milhares de fotos para o computador! Se você mostrar 10.000 fotos de gatinhos e cachorrinhos, o computador aprende sozinho a reconhecer quem é quem pelas orelhas, focinho e formato!",
            },
            {
                "title": "Redes neurais: inspiradas no cérebro",
                "text": "Nosso cérebro tem neurônios que se comunicam. Os computadores passaram a usar redes neurais artificiais, que funcionam em camadas: a primeira camada enxerga linhas e cores simples, e as camadas mais fundas reconhecem o rosto ou objeto inteiro!",
            },
            {
                "title": "O poder do Big Data e das placas de vídeo",
                "text": "Com a internet, surgiram bilhões de dados (textos, imagens e vídeos), o chamado Big Data. Além disso, as placas de vídeo (GPUs) usadas nos videogames ajudaram os computadores a fazer milhões de contas ao mesmo tempo, bem rápido.",
            },
            {
                "title": "Assistentes de voz no seu bolso",
                "text": "Foi nessa época que nasceram os assistentes de voz dos celulares e os tradutores automáticos, que entendem o que você fala e respondem em poucos segundos!",
            },
        ],
        "quiz": [
            {
                "question": "Como o aprendizado de máquina ensina um computador a reconhecer um gato?",
                "options": [
                    "Pintando a tela do computador com tinta amarela",
                    "Desligando a tomada do computador para ele adivinhar",
                    "Mostrando milhares de fotos de gatos para ele aprender os detalhes sozinho",
                ],
                "answer": 2,
                "justification": "Muito bem! Vendo muitos exemplos de fotos, o computador aprende sozinho a identificar os padrões.",
            },
            {
                "question": "No que os cientistas se inspiraram para criar as redes neurais?",
                "options": [
                    "Nas correntes de uma bicicleta",
                    "No funcionamento dos neurônios do nosso cérebro",
                    "Nas rodas de um skate",
                ],
                "answer": 1,
                "justification": "Isso aí! Elas foram inspiradas no modo como os neurônios do cérebro humano se conectam.",
            },
            {
                "question": "O que é Big Data no mundo da internet?",
                "options": [
                    "Uma quantidade gigantesca de fotos, textos e vídeos na rede",
                    "O nome de um teclado bem grande",
                    "Um jogo de videogame antigo de tabuleiro",
                ],
                "answer": 0,
                "justification": "Parabéns! Big Data é o nome dado a esse montão de informações que usamos para ensinar os robôs.",
            },
            {
                "question": "Qual peça dos videogames ajudou os computadores a aprenderem muito mais rápido?",
                "options": [
                    "O controle sem fio que vibra na mão",
                    "A caixa de papelão do videogame",
                    "As placas de vídeo (GPUs), que fazem muitas contas ao mesmo tempo",
                ],
                "answer": 2,
                "justification": "Excelente! As placas de vídeo (GPUs) são campeãs em calcular muitas contas de uma vez só.",
            },
        ],
        "minigame": {
            "type": "word_search",
            "title": "Caça-palavras do aprendizado de máquina",
            "instruction": "Arraste ou clique nas letras em sequência para encontrar todas as palavras escondidas!",
            "target_points": 50,
            "variations": [
                {"theme": "Aprendizado dos robôs", "words": ["DADOS", "NEURAL", "FOTOS", "ROBO", "VOZ"]},
                {"theme": "Tecnologia e imagens", "words": ["REDE", "IMAGEM", "GPU", "TEXTO", "AUDIO"]},
                {"theme": "Super inteligência", "words": ["TREINO", "PADRAO", "SMART", "CHIP", "FUTURO"]},
            ],
        },
    },
    {
        "id": 4,
        "period": "2020 até hoje",
        "title": "Robôs escritores e artistas",
        "description": "IAs que criam histórias, desenhos, músicas e ajudam a tirar dúvidas com pedidos chamados prompts.",
        "color": "yellow",
        "eyebrow": "2020 até o presente · Estação 4",
        "lesson_title": "A era dos robôs escritores e artistas",
        "intro": "Como as IAs modernas aprenderam a conversar, criar histórias, desenhar imagens incríveis e ajudar nos estudos!",
        "sections": [
            {
                "title": "IAs que criam: a Inteligência Artificial Generativa",
                "text": "A partir de 2020, surgiram ferramentas de conversa e criadores de imagens. Elas são chamadas de IA Generativa porque conseguem gerar coisas novas a partir do que aprenderam: histórias, poemas, desenhos, músicas e até códigos de programação!",
            },
            {
                "title": "O que é um prompt?",
                "text": "Um prompt é a mensagem ou pedido que você digita para a IA. Por exemplo: escreva uma história sobre um cachorrinho astronauta no planeta Marte. Quanto mais claro e detalhado for o seu pedido, melhor será a resposta!",
            },
            {
                "title": "Cuidado com as alucinações da IA!",
                "text": "A IA não tem sentimentos nem sabe tudo de verdade. Às vezes, ela inventa informações falsas com muita certeza! Esse erro é chamado de alucinação. Por isso, nunca devemos copiar tudo sem conferir em livros ou com professores.",
            },
            {
                "title": "Segurança e privacidade na internet",
                "text": "Nunca compartilhe seus dados pessoais, como senhas, endereço ou fotos privadas, com robôs de conversa na internet. Use a IA para aprender, tirar dúvidas e se divertir com muita responsabilidade!",
            },
        ],
        "quiz": [
            {
                "question": "O que é um prompt quando você conversa com uma IA?",
                "options": [
                    "É o botão vermelho de ligar o monitor",
                    "É a pergunta ou pedido que você digita para ela responder",
                    "É o cabo de energia da tomada",
                ],
                "answer": 1,
                "justification": "Muito bem! O prompt é a mensagem com as instruções e pedidos que você envia para a IA.",
            },
            {
                "question": "O que a Inteligência Artificial Generativa consegue criar?",
                "options": [
                    "Textos, desenhos, histórias e ideias a partir dos nossos pedidos",
                    "Uma casa de tijolos de verdade em 5 segundos",
                    "Um portal mágico para viajar no tempo",
                ],
                "answer": 0,
                "justification": "Isso aí! Ela pode gerar conteúdos novos bem legais, como histórias, resumos e ilustrações.",
            },
            {
                "question": "O que significa quando dizemos que a IA alucinou?",
                "options": [
                    "Ela ficou com sono e desligou o computador",
                    "Ela começou a tocar violão sozinha",
                    "Ela inventou uma resposta errada parecendo que estava certa",
                ],
                "answer": 2,
                "justification": "Perfeito! Às vezes a IA se confunde e inventa coisas. Por isso é importante sempre conferir.",
            },
            {
                "question": "Qual é a atitude correta e segura ao usar robôs de Inteligência Artificial?",
                "options": [
                    "Acreditar em tudo sem ler e passar o telefone dos pais",
                    "Nunca passar senhas nem endereço e sempre conferir as informações",
                    "Copiar todas as tarefas da escola sem estudar",
                ],
                "answer": 1,
                "justification": "Excelente! Proteger seus dados e conferir as informações são atitudes de um usuário inteligente.",
            },
        ],
        "minigame": {
            "type": "memory",
            "title": "Memória dos robôs escritores",
            "instruction": "Encontre o par de cada termo da IA generativa com o seu significado!",
            "target_points": 60,
            "pairs": [
                {"id": "p1", "term": "Prompt", "match": "Pedido ou mensagem que você digita para a IA"},
                {"id": "p2", "term": "IA Generativa", "match": "Cria textos, desenhos e histórias novas"},
                {"id": "p3", "term": "Alucinação da IA", "match": "Quando a IA inventa uma resposta errada"},
                {"id": "p4", "term": "Privacidade", "match": "Proteger suas senhas e dados pessoais"},
                {"id": "p5", "term": "Chatbot", "match": "Robô moderno que conversa por mensagens"},
                {"id": "p6", "term": "Criador de imagens", "match": "Transforma pedidos escritos em desenhos"},
            ],
        },
    },
    {
        "id": 5,
        "period": "O futuro da IA",
        "title": "Os guardiões do futuro",
        "description": "Como usar a tecnologia para ajudar a natureza, a medicina e cuidar das pessoas com respeito.",
        "color": "purple",
        "eyebrow": "Próximos capítulos · Estação 5",
        "lesson_title": "Os guardiões do futuro digital",
        "intro": "Como usar a inteligência artificial para ajudar o planeta, a medicina e cuidar das pessoas com respeito e responsabilidade!",
        "sections": [
            {
                "title": "A IA ajudando os médicos e a natureza",
                "text": "A Inteligência Artificial pode ser uma super ajudante dos humanos! Ela ajuda médicos a descobrirem doenças mais rápido nos hospitais e até avisa quando uma floresta corre perigo de queimada usando imagens do espaço.",
            },
            {
                "title": "Cuidado com preconceitos e injustiças",
                "text": "Se um computador aprender apenas com informações que tinham preconceito ou injustiça, ele pode repetir esses mesmos erros. Por isso, os cientistas trabalham para ensinar a IA a ser justa, respeitosa e igual para todo mundo.",
            },
            {
                "title": "Os seres humanos sempre no comando!",
                "text": "A tecnologia é muito legal, mas as decisões mais importantes sobre a vida, a saúde e as leis devem sempre ser tomadas por pessoas! A IA é uma ferramenta para ajudar a humanidade, não para substituir o carinho e o bom senso humano.",
            },
            {
                "title": "Você é o futuro da tecnologia!",
                "text": "Aprender como a tecnologia funciona ajuda você a ser um cidadão inteligente, capaz de inventar soluções para o mundo e usar a internet de forma ética, segura e divertida!",
            },
        ],
        "quiz": [
            {
                "question": "Como a Inteligência Artificial pode ajudar a cuidar do nosso planeta?",
                "options": [
                    "Gastando energia à toa sem ajudar em nada",
                    "Secando a água dos rios e mares",
                    "Analisando fotos de satélite para proteger florestas e animais",
                ],
                "answer": 2,
                "justification": "Muito bem! A IA ajuda os cientistas a monitorar florestas, oceanos e a natureza.",
            },
            {
                "question": "Por que uma Inteligência Artificial pode dar respostas injustas ou com preconceito?",
                "options": [
                    "Porque o teclado do computador quebrou uma tecla",
                    "Porque ela aprendeu com textos da internet que continham erros e preconceitos",
                    "Porque o computador ficou zangado",
                ],
                "answer": 1,
                "justification": "Isso mesmo! A IA reflete o que aprendeu. Por isso devemos ensiná-la sempre com respeito e igualdade.",
            },
            {
                "question": "Por que os seres humanos devem sempre tomar as decisões mais importantes?",
                "options": [
                    "Porque as pessoas têm sentimentos, bom senso e responsabilidade",
                    "Porque os computadores não gostam de pensar",
                    "Porque as máquinas têm preguiça",
                ],
                "answer": 0,
                "justification": "Perfeito! A empatia, o carinho e a responsabilidade humana são únicos e insubstituíveis.",
            },
            {
                "question": "O que significa usar a tecnologia de forma ética e responsável?",
                "options": [
                    "Usar robôs para espalhar mentiras e enganar amigos",
                    "Achar que as máquinas devem mandar no mundo",
                    "Usar a tecnologia para fazer o bem, respeitar os outros e falar a verdade",
                ],
                "answer": 2,
                "justification": "Excelente! Ética é usar a tecnologia com sabedoria para construir um futuro melhor para todos.",
            },
        ],
        "minigame": {
            "type": "snake",
            "title": "Cobrinha dos dados: colete 20 bolinhas",
            "instruction": "Controle a cobrinha com as setas ou o WASD e colete as bolinhas sem bater no próprio corpo!",
            "target_score": 20,
        },
    },
]


# ---------------------------------------------------------------------------
# Compatibilidade com o formato antigo (TIMELINE + LESSONS)
# ---------------------------------------------------------------------------

def para_timeline(atividades):
    """Converte a lista unificada no formato exibido pela linha do tempo."""
    return [
        {
            "id": atividade["id"],
            "period": atividade["period"],
            "title": atividade["title"],
            "description": atividade["description"],
            "color": atividade.get("color", "blue"),
            "completed": False,
        }
        for atividade in atividades
    ]


def para_licoes(atividades):
    """Converte a lista unificada no dicionario de aulas indexado por id."""
    return {
        atividade["id"]: {
            "eyebrow": atividade.get("eyebrow", atividade["period"]),
            "title": atividade.get("lesson_title", atividade["title"]),
            "intro": atividade.get("intro", atividade["description"]),
            "sections": atividade.get("sections", []),
            "quiz": atividade.get("quiz", []),
            "minigame": atividade.get("minigame", {"type": "nenhum"}),
        }
        for atividade in atividades
    }


TIMELINE = para_timeline(ATIVIDADES_PADRAO)
LESSONS = para_licoes(ATIVIDADES_PADRAO)
