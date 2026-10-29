/** Navegação assistida: textos curtos de ajuda por botão e as perguntas da página de ajuda. */

export const HELP_DELAY_MS = 2000;

export type HelpEntry = { title: string; text: string };

/** Chave = nome do botão (aria-label ou texto), em minúsculas. */
const HELP: Record<string, HelpEntry> = {
  voltar: { title: "Voltar", text: "Volta para a tela em que você estava antes." },
  "tema do app": {
    title: "Tema",
    text: "Troca entre modo claro, escuro ou o do seu celular. Escolha o que cansa menos a vista.",
  },
  "caixa de sugestões": {
    title: "Caixa de sugestões",
    text: "Mande uma ideia ou conte um problema. Só a equipe do Beecos lê.",
  },
  avisos: {
    title: "Avisos",
    text: "Mostra vagas novas da sua área e outros avisos. O número vermelho são os que você ainda não viu.",
  },
  entrar: { title: "Entrar", text: "Entre na sua conta ou crie uma. É rápido e grátis." },
  início: {
    title: "Início",
    text: "A página inicial, com atalhos por assunto e o que está acontecendo.",
  },
  "quero contratar": {
    title: "Quero contratar",
    text: "Publique o serviço que você precisa. Quem trabalha na área vê, conversa com você e você escolhe quem faz.",
  },
  "quero trabalhar": {
    title: "Quero trabalhar",
    text: "Publique que você está disponível e o que sabe fazer. Quem precisa encontra você e chama no chat.",
  },
  publicar: {
    title: "Publicar",
    text: "Abre a tela para publicar uma vaga ou dizer que você está disponível.",
  },
  vagas: { title: "Vagas", text: "Procure vagas e serviços por profissão, cidade ou palavra." },
  comunidade: {
    title: "Comunidade",
    text: "Grupos por profissão, com as vagas rápidas da sua área em um feed, como numa rede social.",
  },
  conversas: {
    title: "Conversas",
    text: "Suas conversas com quem se interessou pela vaga, ou pelas que você procurou.",
  },
  "meu perfil": {
    title: "Meu perfil",
    text: "Seus dados, suas habilidades, suas vagas e seu plano.",
  },
  "+ grupos": {
    title: "Mais grupos",
    text: "Escolha em quais grupos de profissão entrar para ver as vagas deles.",
  },
  todos: { title: "Todos os grupos", text: "Mostra as vagas de todos os grupos em que você está." },
  sair: {
    title: "Sair do grupo",
    text: "Você deixa de ver as vagas desse grupo no feed. Dá para entrar de novo quando quiser.",
  },
  "sair do grupo": {
    title: "Sair do grupo",
    text: "Você deixa de ver as vagas desse grupo no feed. Dá para entrar de novo quando quiser.",
  },
  "inscrever-se": {
    title: "Inscrever-se",
    text: "Abre uma conversa com quem publicou a vaga, para combinar os detalhes. O endereço só aparece no chat.",
  },
  "saiba mais": {
    title: "Saiba mais",
    text: "Abre a página completa da vaga, com todos os detalhes.",
  },
  "ver interessados": {
    title: "Ver interessados",
    text: "Mostra quem quer a sua vaga e deixa você escolher.",
  },
  encerrada: {
    title: "Vaga encerrada",
    text: "Todas as vagas já foram preenchidas. Não dá mais para se inscrever.",
  },
  denunciar: {
    title: "Denunciar",
    text: "Avise a moderação sobre golpe ou abuso. As duas contas ficam 2 horas em vigilância, sem negociar, enquanto uma pessoa da moderação avalia.",
  },
  planos: { title: "Planos", text: "Compare o plano Grátis com o Premium." },
  termos: { title: "Termos de uso", text: "As regras de uso do Beecos." },
  privacidade: { title: "Privacidade", text: "Como cuidamos dos seus dados, conforme a LGPD." },
  "enviar ideia": { title: "Enviar ideia", text: "Manda a sua sugestão para a equipe." },
  ajuda: { title: "Ajuda", text: "Perguntas frequentes e como usar o Beecos." },
};

/** Texto de ajuda para o nome de um botão; null se não houver. */
export function helpFor(label: string | null | undefined): HelpEntry | null {
  const key = (label ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  if (!key || key.length > 40) return null;
  if (HELP[key]) return HELP[key];
  // "Avisos, 3 não lidos", "Conversas, 2 não lidas"…
  const head = key.split(",")[0]?.trim() ?? "";
  return HELP[head] ?? null;
}

export const FAQ: { q: string; a: string; id?: string }[] = [
  {
    q: "O que é o Beecos?",
    a: "Um lugar para achar quem faz o serviço que você precisa, e para quem trabalha encontrar vagas perto de casa.",
  },
  {
    q: "Como publico uma vaga?",
    a: "Toque em Quero contratar na tela inicial, ou em Publicar na tela de Vagas ou em Meu perfil. Diga a profissão, o serviço, o valor e quantas pessoas você precisa. Para oferecer o seu trabalho, escolha Quero trabalhar.",
  },
  {
    id: "avaliacoes",
    q: "Como funcionam as avaliações?",
    a: "Só dá para avaliar depois que o serviço é marcado como concluído no chat. Aí as duas pessoas podem se avaliar com estrelas e um comentário, e a nota aparece no perfil de cada uma.",
  },
  {
    q: "Meu endereço fica público?",
    a: "Não. Quem vê a vaga só vê a distância. O local combinado aparece apenas na conversa.",
  },
  {
    q: "Como funciona a Comunidade?",
    a: "Cada profissão é um grupo. Quando você cadastra uma habilidade, entra no grupo dela. As vagas desses grupos aparecem no seu feed, você recebe um aviso quando surge vaga nova neles, e pode entrar e sair dos grupos quando quiser.",
  },
  {
    q: "O que é o Premium?",
    a: "Um plano com mais vagas por mês e recursos extras. Veja o comparativo na página de Planos.",
  },
  {
    q: "Como denuncio algo?",
    a: "Use o botão Denunciar na vaga ou no perfil. Quem denunciou e quem foi denunciado ficam 2 horas sem negociar, publicar vagas nem receber propostas, e um moderador avalia o caso. Se a denúncia for descartada, a vigilância acaba na hora.",
  },
  {
    q: "Como apago a minha conta e os meus dados?",
    a: "Em Meu perfil, na área de Privacidade, você baixa seus dados ou exclui a conta.",
  },
  {
    q: "Tenho uma ideia ou encontrei um problema.",
    a: "Toque na lâmpada no topo da tela e escreva. A equipe lê todas as sugestões.",
  },
];
