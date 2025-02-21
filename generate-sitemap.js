import fs from 'fs';
import path from 'path';
import { SitemapStream, streamToPromise } from 'sitemap';
import prettier from 'prettier';


// 사이트 기본 URL
const hostname = 'https://korvesting.netlify.app';

// sitemap에 포함할 페이지 목록
const pages = [
  { url: '/', priority: 1.00 },
  { url: '/포폴.html', priority: 0.90 },
  { url: '/유명인포폴.html', priority: 0.80 }
];

// HTML 파일 및 sitemap.xml이 저장될 디렉터리
const publicDir = 'C:\\YoungDexter';

// 각 페이지의 마지막 수정 시간을 파일 시스템에서 가져와 lastmod 값 추가
pages.forEach(page => {
  const filePath = path.join(publicDir, page.url.substring(1));

  try {
    const stats = fs.statSync(filePath);
    page.lastmod = stats.mtime.toISOString();
  } catch (err) {
    console.error(`❌ 파일을 찾을 수 없습니다: ${filePath}`, err);
    page.lastmod = new Date().toISOString();
  }
});

// SitemapStream을 사용하여 sitemap 생성
const sitemapStream = new SitemapStream({ hostname });

// 각 페이지 정보를 sitemapStream에 기록
pages.forEach(page => {
  sitemapStream.write(page);
});
sitemapStream.end();

// 생성된 sitemap 데이터를 파일로 저장
const sitemapPath = path.join(publicDir, 'sitemap.xml');
streamToPromise(sitemapStream)
  .then(sm => {
    const formattedXml = prettier.format(sm.toString(), {
      parser: "xml",
      plugins: ["prettier-plugin-xml"] // XML 플러그인 추가
    });

    fs.writeFileSync(sitemapPath, formattedXml);
    console.log('✅ sitemap.xml 파일이 성공적으로 생성되었습니다:', sitemapPath);
  })
  .catch(err => {
    console.error('❌ sitemap 생성 중 에러 발생:', err);
  });
