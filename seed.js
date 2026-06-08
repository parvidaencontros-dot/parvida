const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'db.json');

function hashPassword(pwd) {
  return crypto.createHash('sha256').update(pwd + 'match_salt_2024').digest('hex');
}
function generateId() {
  return crypto.randomBytes(16).toString('hex');
}
function getAvatar(seed, gender) {
  const style = gender === 'feminino' ? 'adventurer' : 'big-smile';
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

const users = [
  // Mulheres
  { name: 'Ana Carvalho', email: 'ana@demo.com', age: 26, gender: 'feminino', interest: 'masculino', bio: 'Amo viajar, café e bons livros. Procuro alguém para aventuras!', city: 'São Paulo' },
  { name: 'Julia Mendes', email: 'julia@demo.com', age: 23, gender: 'feminino', interest: 'masculino', bio: 'Artista plástica, gosto de museus e trilhas.', city: 'Rio de Janeiro' },
  { name: 'Fernanda Lima', email: 'fernanda@demo.com', age: 29, gender: 'feminino', interest: 'masculino', bio: 'Chef de cozinha apaixonada por culinária italiana 🍝', city: 'Curitiba' },
  { name: 'Camila Rocha', email: 'camila@demo.com', age: 24, gender: 'feminino', interest: 'masculino', bio: 'Médica em formação, apaixonada por ciência e natureza.', city: 'Belo Horizonte' },
  { name: 'Isabela Souza', email: 'isabela@demo.com', age: 27, gender: 'feminino', interest: 'masculino', bio: 'Fotógrafa freelancer. Sempre com a câmera na mão! 📷', city: 'Porto Alegre' },
  { name: 'Mariana Costa', email: 'mariana@demo.com', age: 25, gender: 'feminino', interest: 'feminino', bio: 'Música, gatos e cafés aconchegantes.', city: 'Florianópolis' },
  // Homens
  { name: 'Lucas Oliveira', email: 'lucas@demo.com', age: 28, gender: 'masculino', interest: 'feminino', bio: 'Engenheiro de software, guitarra nas horas vagas 🎸', city: 'São Paulo' },
  { name: 'Pedro Alves', email: 'pedro@demo.com', age: 30, gender: 'masculino', interest: 'feminino', bio: 'Empreendedor, amante de esportes e gastronomia.', city: 'Rio de Janeiro' },
  { name: 'Rafael Santos', email: 'rafael@demo.com', age: 25, gender: 'masculino', interest: 'feminino', bio: 'Designer gráfico. Crio mundos com pixels e cores.', city: 'Recife' },
  { name: 'Thiago Ferreira', email: 'thiago@demo.com', age: 32, gender: 'masculino', interest: 'masculino', bio: 'Professor de história, viajante nas férias 🌍', city: 'Salvador' },
  { name: 'Bruno Martins', email: 'bruno@demo.com', age: 27, gender: 'masculino', interest: 'feminino', bio: 'Personal trainer. Saúde e bem-estar em primeiro lugar!', city: 'Fortaleza' },
];

const db = { users: [], sessions: {} };

users.forEach(u => {
  db.users.push({
    id: generateId(),
    ...u,
    password: hashPassword('demo123'),
    avatar: getAvatar(u.name, u.gender),
    likes: [],
    matches: [],
    createdAt: new Date().toISOString()
  });
});

fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
console.log(`✅ Banco populado com ${db.users.length} perfis demo!`);
console.log('📧 Todos os perfis demo usam a senha: demo123');
console.log('   Ex: ana@demo.com / demo123');
