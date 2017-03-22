#!/usr/bin/env python
# -*- coding: utf-8 -*-

from gensim.models.word2vec import Word2Vec
import logging
import sys

def s(posi, nega=[], n=5):
	result = model.most_similar( positive = posi, negative = nega, topn = n)
	sep = "" ;
	outstr = '['
	for r in result:
		outstr += sep+'"'+r[0].encode('utf_8')+'"'
		sep = ","
	outstr += ']'
	output_result( outstr );

#if __name__ == '__main__':
#	word = sys.argv[1]
#	word = unicode(word,'utf-8')
#	s([word])

posi = []
if 'p' in form:
	posi_in = urllib.unquote(form['p'].value).split(",") ;
	for word in posi_in:
		posi.append( unicode(word,'utf-8') )

nega = []
if 'n' in form:
	nega_in = urllib.unquote(form['n'].value).split(",") ;
	for word in nega_in:
		nega.append( unicode(word,'utf-8') )

model = Word2Vec.load('./word2vec.gensim.model')
s(posi,nega)
