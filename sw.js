/* 여행 스케줄표 — 오프라인 지원
   화면(HTML)은 네트워크 먼저, 안 되면 캐시에서. 나머지 같은 출처 파일은 캐시 먼저.
   날씨 API 같은 외부 주소는 건드리지 않는다. */
'use strict';

var CACHE = 'trip-planner-v1';
var ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE)
      .then(function(c){ return c.addAll(ASSETS); })
      .catch(function(){})                 // 일부 파일이 없어도 설치는 계속
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){ return k === CACHE ? null : caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch(err){ return; }
  if (url.origin !== self.location.origin) return;     // 날씨 API 등은 그대로 네트워크로

  var isPage = req.mode === 'navigate' || /\.html$/.test(url.pathname) || url.pathname === '/' || url.pathname.slice(-1) === '/';

  if (isPage){
    // 화면은 네트워크 먼저 (최신 유지), 실패하면 캐시
    e.respondWith(
      fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put('./index.html', copy); }).catch(function(){});
        return res;
      }).catch(function(){
        return caches.match('./index.html').then(function(hit){
          return hit || caches.match('./') || new Response('오프라인입니다.', { headers:{ 'Content-Type':'text/plain; charset=utf-8' } });
        });
      })
    );
    return;
  }

  // 그 밖의 같은 출처 파일(아이콘, 여행 JSON 등)은 캐시 먼저
  e.respondWith(
    caches.match(req).then(function(hit){
      if (hit) return hit;
      return fetch(req).then(function(res){
        if (res && res.status === 200 && res.type === 'basic'){
          var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); }).catch(function(){});
        }
        return res;
      });
    })
  );
});
