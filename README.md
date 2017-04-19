needs 「[日本語 Wikipedia エンティティベクトル](http://www.cl.ecei.tohoku.ac.jp/~m-suzuki/jawiki_vector/)」for execution.
We only use text version of the learned DB.

```bash
$ mget http://www.cl.ecei.tohoku.ac.jp/~m-suzuki/jawiki_vector/data/20170201.tar.bz2
$ bunzip2 20170201.tar.bz2
$ tar xvf 20170201.tar
$ rm 20170201.tar.bz2 entity_vector/entity_vector.model.bin
$ npm install
$ node server.js
```


# 要約データベースの教師データの作り方

1. Bookmarkletとして
```
javascript:$.getJSON('http://lifedesign.tech:8080/livedoorNews',{q:encodeURIComponent(JSON.stringify({summary:$('.summaryList').html(),body:$('span[itemprop="articleBody"]').html(),headline:$('h1[itemprop="headline"]').html(),url:location.href}))},function(re){alert('OK. result='+JSON.stringify(re));})
```
を入れる。

2. [livedoor news](http://news.livedoor.com/)のうち、「ざっくり言うと」がついているものを選ぶ。通常は**http://news.livedoor.com/topics/detail/[数値]/**みたいなURLになる。

3. 「ざっくり言うと」が表示されているページで1.のBookmarklet実行。alertでOKとでるはず。

4. 「記事を読む」をたどる。通常は先ほどのURLのtopicsがartcleに変更されたページが開くはず
もし開いた先がlivedoor newsではない外部サイトの場合は2に戻る。

5. ここで再び1.のBookmarkletを実行。alertが開く。

6. 2-5を繰り返す。
