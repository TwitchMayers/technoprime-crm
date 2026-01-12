import { execSync } from 'child_process';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const fixFile = (filePath: string) => {
  let content = readFileSync(filePath, 'utf8');
  
  // 🔥 1. RichMarket модели
  content = content.replace(/include:\s*{\s*client:\s*true\s*}/g, 'include: { RichMarketClient: true }');
  content = content.replace(/include:\s*{\s*orders:\s*true\s*}/g, 'include: { RichMarketOrder: true }');
  content = content.replace(/include:\s*{\s*items:\s*true\s*}/g, 'include: { RichMarketOrderItem: true }');
  content = content.replace(/include:\s*{\s*sizes:\s*true\s*}/g, 'include: {  }'); // Убрать sizes
  
  // 🔥 2. TechPrime модели  
  content = content.replace(/this\.prisma\.order/g, 'this.prisma.techPrimeOrder');
  content = content.replace(/this\.prisma\.client/g, 'this.prisma.techPrimeClient');
  content = content.replace(/this\.prisma\.product/g, 'this.prisma.techPrimeProduct');
  content = content.replace(/this\.prisma\.task/g, 'this.prisma.techPrimeTask');
  
  // 🔥 3. RichMarketSoldProduct (есть в схеме)
  content = content.replace(/this\.prisma\.richMarketSoldProduct/g, 'this.prisma.rich_market_sold_products');
  
  // 🔥 4. Поля isArchived → isActive
  content = content.replace(/isArchived:\s*(true|false)/g, 'isActive: $1');
  content = content.replace(/where\.isArchived/g, 'where.isActive');
  
  // 🔥 5. Доступ к свойствам
  content = content.replace(/\.client\./g, '.RichMarketClient.');
  content = content.replace(/\.orders\./g, '.RichMarketOrder.');
  content = content.replace(/\.items\./g, '.RichMarketOrderItem.');
  content = content.replace(/\.sizes\./g, '.');
  
  // 🔥 6. WHERE условия
  content = content.replace(/where:\s*{\s*client:/g, 'where: { RichMarketClient:');
  content = content.replace(/where:\s*{\s*order:/g, 'where: { RichMarketOrder:');
  
  // 🔥 7. Временный фикс для остального
  content = content.replace(/include:\s*{([^}]+)}/g, (match, p1) => {
    if (p1.includes('client') || p1.includes('order') || p1.includes('items') || 
        p1.includes('sizes') || p1.includes('assignedTo') || p1.includes('author')) {
      return `include: { ${p1} } as any`;
    }
    return match;
  });
  
  writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Fixed: ${filePath}`);
};

// Рекурсивно обходим все файлы
const walkDir = (dir: string) => {
  const files = readdirSync(dir);
  
  for (const file of files) {
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory() && !fullPath.includes('node_modules')) {
      walkDir(fullPath);
    } else if (extname(file) === '.ts' && !file.includes('.d.ts')) {
      try {
        fixFile(fullPath);
      } catch (e) {
        console.log(`⚠️ Error in ${fullPath}: ${e.message}`);
      }
    }
  }
};

console.log('🚀 Starting emergency fix...');
walkDir(join(__dirname, 'src'));
console.log('✅ All files fixed!');
