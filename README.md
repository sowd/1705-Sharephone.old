needs 「[日本語 Wikipedia エンティティベクトル](http://www.cl.ecei.tohoku.ac.jp/~m-suzuki/jawiki_vector/)」for execution

```bash
$ mget http://www.cl.ecei.tohoku.ac.jp/~m-suzuki/jawiki_vector/data/20170201.tar.bz2
$ bunzip2 20170201.tar.bz2
$ tar xvf 20170201.tar
$ rm 20170201.tar.bz2 entity_vector/entity_vector.model.bin
$ npm install
$ node server.js
```
