// 네이버 블로그 RSS를 읽어서 최신 글 3개를 blog-posts.json으로 저장하는 스크립트
// GitHub Actions가 매일 자동으로 이 스크립트를 실행합니다.

const fs = require('fs');
const path = require('path');

const RSS_URL = 'https://rss.blog.naver.com/coldwoman77.xml';
const OUTPUT_PATH = path.join(__dirname, '..', 'blog-posts.json');
const POST_COUNT = 3;

function stripCdata(str) {
  if (!str) return '';
  return str.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim();
}

function stripHtml(str) {
  if (!str) return '';
  return str
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTag(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = block.match(re);
  return m ? m[1].trim() : '';
}

function formatDate(pubDate) {
  if (!pubDate) return '';
  const d = new Date(pubDate);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')} 게시`;
}

async function main() {
  console.log('RSS 가져오는 중:', RSS_URL);

  const res = await fetch(RSS_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OsongMisoBlogBot/1.0)' }
  });

  if (!res.ok) {
    throw new Error(`RSS 응답 실패: ${res.status}`);
  }

  const xml = await res.text();
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];

  if (itemBlocks.length === 0) {
    throw new Error('RSS에서 글을 찾지 못했습니다. (구조 변경 가능성)');
  }

  const posts = itemBlocks.slice(0, POST_COUNT).map(block => {
    const titleRaw = extractTag(block, 'title');
    const linkRaw = extractTag(block, 'link');
    const descRaw = extractTag(block, 'description');
    const pubDate = extractTag(block, 'pubDate');

    const title = stripHtml(stripCdata(titleRaw));
    const link = stripHtml(stripCdata(linkRaw));
    const descText = stripHtml(stripCdata(descRaw));
    const excerpt = descText.length > 80 ? descText.slice(0, 80) + '…' : descText;

    return {
      title: title || '제목 없음',
      link: link || 'https://blog.naver.com/coldwoman77',
      excerpt: excerpt || '',
      date: formatDate(pubDate)
    };
  });

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify({ updatedAt: new Date().toISOString(), posts }, null, 2));
  console.log(`완료: ${posts.length}개 글을 저장했습니다.`);
  posts.forEach(p => console.log(' -', p.title));
}

main().catch(err => {
  console.error('블로그 업데이트 실패:', err.message);
  // 실패해도 워크플로우 자체를 에러로 끝내지 않음 (기존 blog-posts.json 유지)
  process.exit(0);
});
