//  /corpus/				corpus list
//  /corpus/nagoya1			get corpus content
//	/mecab/?q=SENTENSE		analyze 'SETNTENSE' by mecab
//	/w2v/?q=[w1,w2,..]		calculate w2v average for word array

const OUTPUT_WORD_FREQUENCY_STATISTICS = false ;


var fs = require('fs');
var NCMB = require("ncmb");

const ncmbinfo = JSON.parse(fs.readFileSync('ncmbinfo.json').toString()) ;
var ncmb = new NCMB( ncmbinfo.ak,ncmbinfo.ck );

var DB = ncmb.DataStore("JPWikipedia");

var log = console.log ;

var q_cache = {} ;
try {
	q_cache = JSON.parse(fs.readFileSync('q_cache.json').toString()) ;
} catch(e){} ;
//function q_cache_replacer(k,v){if( v instanceof Array ) return v.join(','); return v}
var q_cache_replacer = null ;

// vector query main.
function q(word){
	return new Promise((ac,rj)=>{
		if( q_cache[word] != undefined ){
			ac(q_cache[word]) ;
			return ;
		}
		DB.in("Key",[word,'['+word+']']).fetchAll().then(re=>{
			if( re == undefined ){
				rj('No vector found :'+word);
				return;
			}
			switch( re.length ){
			case 0 :
				rj('No vector found :'+word);
				return;
			case 1 :
				q_cache[word]=re[0].Vector;
				ac(re[0].Vector);
				fs.writeFileSync('q_cache.json',JSON.stringify(q_cache,q_cache_replacer,"\t")) ;
				return ;
			case 2 :
				var r=[] ;
				for( var xi=0;xi<re[0].Vector.length;++xi )
					r.push( 0.5 * (re[0].Vector[xi] + re[1].Vector[xi]) ) ;
				q_cache[word]=r ;
				fs.writeFileSync('q_cache.json',JSON.stringify(q_cache,q_cache_replacer,"\t")) ;
				ac( r ) ;
				return ;
			}
			rj('Too many vectors ('+re.length+') found :'+word) ;
		}).catch(()=>{rj('No vector found :'+word);}) ;

	}) ;
}

// https://github.com/eirikhm/web-emoji/blob/master/sandbox/deprecated
const emoji_ranges = [ '\ud83c[\udf00-\udfff]', '\ud83d[\udc00-\ude4f]', '\ud83d[\ude80-\udeff]', '\ud7c9[\ude00-\udeff]', '[\u2600-\u27BF]' ];
var emoji_ex = new RegExp(emoji_ranges.join('|'), 'g');
function remove_unnecessary(text){
	return text
		.replace(emoji_ex, '')
		//.replace(/\{.*?\}/g, '') // Does not work..
		;
}

/*q('ハワイロア').then(v=>{
	log(v) ;
}).catch(()=>{log('No entry found.')});
*/
function analyze_w2v_eachword( nouns ){
	return new Promise( (accept,reject)=>{
		if( nouns.length>0 ){
			Promise.all(nouns.map(w=>{
				return new Promise((ac,rj)=>{
					q(w).then(ac).catch(ac) ;
				}) ;
			})).then(accept).catch(reject) ;
		} else {
			reject('No nouns provided.') ;
		}
	}) ;
}
function analyze_w2v_phrase( nouns ){
	return new Promise( (accept,reject)=>{
		analyze_w2v_eachword.then(vecs=>{
			var v_av , avail_num = 0 ;
			vecs.forEach(vec=>{
				if( vec instanceof Array ){
					++avail_num ;
					if( v_av == undefined ) v_av = vec ;
					else {
						for( var xi=0;xi<v_av.length;++xi )
							v_av[xi] += vec[xi] ;
					}
				}
			}) ;
			for( var xi=0;xi<v_av.length;++xi )
				v_av[xi] /= avail_num ;
			//log(nouns.join('') +'=>'+JSON.stringify(v_av) ) ;
			accept(v_av) ;
		}).catch(reject) ;
	}) ;
}


var MeCab = new require('mecab-async') , mecab = new MeCab() ;
function analyze_mecab(qstr){
	return new Promise((ac,rj)=>{
		mecab.parse(qstr, function(err, result) {
			if (err) rj(err);
			else ac(result);
		});
	}) ;
}

var corpus_id_to_filename_map = {} ;

var lines_for_freq=[] ;	// 頻度マップを作る
for( var i=1;i<=129;++i ){
	corpus_id_to_filename_map['nagoya'+i] = 'data/nagoyacorpus/data'+('00'+i).slice(-3)+'.utf8.txt' ;

	if( OUTPUT_WORD_FREQUENCY_STATISTICS ){
		fs.readFileSync('data/nagoyacorpus/data'+('00'+i).slice(-3)+'.utf8.txt').toString().split("\n").forEach(line=>{
			var match_result = line.match( /(^[MF]...)：/ ) ;
			if( match_result == null ) return ;

			var speaker = match_result[1] ;
			var body = line.slice(5) ;
			lines_for_freq.push([speaker,body]) ;
		}) ;
	}
}


var word_freq = {} ;
function post_process_word_freq(){
	var w_total = 0 ;
	var wfarray = [] ;
	for( var k in word_freq ){
		var ts = k.split(':') ;
		//if( ts[1] != '名詞' || ts[2] == '数' ) continue ;
		if( ts[2] != '固有名詞' ) continue ;
		wfarray.push( {word:ts[0], type:ts[2], count:word_freq[k]} ) ;
		w_total += word_freq[k] ;
	}
	wfarray.sort((p,q)=>(q.count-p.count)) ;

	log('ll:'+wfarray.length) ;
	var word_only_for_w2v = [] ;
	wfarray.forEach( wfa=>{
		word_only_for_w2v.push(wfa.word) ;
	}) ;

	word_freq = {} ;
	analyze_w2v_eachword(word_only_for_w2v).then(re=>{
		var w2vsuccess = 0 ;
		log(re.length+':'+wfarray.length) ;
		for( var ri=0;ri<re.length;++ri ){
			var v = wfarray[ri] ;
			v.freq = v.count / w_total ;
			if( re[ri] instanceof Array ){
				v.w2v = re[ri].join(',') ;	// Just to display the result efficiently
				word_freq[v.word] = {type:v.type , freq:v.freq , w2v:re[ri] } ;
				++w2vsuccess ;
			} else log('w2v unsuccessful:'+v.word) ;
		}

		log(`Word frequency data post processed. Selected word count=${w2vsuccess}/${re.length}`) ;
		fs.writeFileSync('word_freq_array.json',JSON.stringify(wfarray,null,"\t")) ;
		fs.writeFileSync('word_freq_map.json',JSON.stringify(word_freq,null,"\t")) ;

		delete wfarray ;
	}).catch( e=>{
		log('analyze_w2v_eachword unsuccessful.') ;
		console.error(e);
	} ) ;
}

if( !OUTPUT_WORD_FREQUENCY_STATISTICS ){
	word_freq = JSON.parse( fs.readFileSync('word_freq_map.json').toString() ) ;
	//word_freq = JSON.parse( fs.readFileSync('word_freq.json').toString() ) ;
	//post_process_word_freq() ;
} else {
	const MAX_MECAB_PROCESS = 100 ;
	function gen_word_freq(){
		var lines_promises = [] ;

		for( var i = 0 ; i < MAX_MECAB_PROCESS && lines_for_freq.length > 0 ; ++i ){
			var la = lines_for_freq.shift() ;
			lines_promises.push( new Promise((ac,rj)=>{
				analyze_mecab(la[1]).then(ac).catch(e=>{
					log('mecab error ('+e+') for:'+body);
					ac([]);
				})
			})) ;
		}

		Promise.all(lines_promises).then(result_array=>{
			log('Lines promises all fired ('+lines_for_freq.length+' more elements)') ;
			result_array.forEach(mecab_split=>{
				mecab_split.forEach(w=>{
					if( w[0] == "\r" || w[1] == 'フィラー') return ;
					var token = `${w[0]}:${w[1]}:${w[2]}` ;
					if( word_freq[token] == undefined )	word_freq[token] = 1 ;
					else								++word_freq[token] ;
				}) ;
				//log(mecab_split) ;
			}) ;

			fs.writeFileSync('word_freq.json',JSON.stringify(word_freq,null,"\t")) ;
			if( lines_for_freq.length == 0 ){
				log('Final freq map generated.') ;
				delete lines_for_freq ;
				post_process_word_freq() ;
			} else gen_word_freq() ;
		}) ;
	}

	gen_word_freq() ;
}


// Start server
var express = require('express')
var app = express();

app.get('/corpus*',(req,res)=>{
	if( req.params.length == 0 || req.params[0].length==0 || req.params[0] == '/'){
		var ret_json = {} ;
		ret_json.corpus = [] ;
		for( var cid in corpus_id_to_filename_map ){
			ret_json.corpus.push(cid) ;
		}
		res.jsonp(ret_json) ;
	} else {
		var cmd = req.params[0].trim().substring(1) ;
		if( cmd.length == 0 ){
				res.jsonp({error:'No such cmd:'+cmd}) ;
		} else {
			var fname = corpus_id_to_filename_map[cmd] ;
			if( fname == undefined ){
				res.jsonp({error:'No such corpus cmd:'+cmd}) ;
			} else {
				var utf8str = fs.readFileSync(fname).toString() ;
				res.jsonp(utf8str.split("\n")) ;
				//res.jsonp({result:utf8str.split("\n")}) ;
			}
		}
	}
}) ;

// APIs
[['mecab',analyze_mecab],['w2v',analyze_w2v_phrase]].forEach(fun=>{
	app.get('/'+fun[0]+'*',(req,res)=>{
		if( req.query.q == undefined ){
			res.jsonp({error:'Please specify a sentence as GET parameter q!'}) ;
			return ;
		}

		var arg ;
		if( typeof req.query.q == 'string')
			arg = decodeURIComponent(req.query.q.trim())  ;
		else
			arg = req.query.q ;

		fun[1](arg).then(re=>{
			res.jsonp(re) ;
		}).catch(e=>{
			res.jsonp(e) ;
		})
	}) ;
}) ;

// Static contents
app.get('/*',(req,res)=>{
	try {
		if( req.url == '/') req.url='/index.html' ;
		res.write(fs.readFileSync('htdocs'+req.url).toString());
		res.end();
	} catch(e){
		res.write('No such file') ;
		res.end() ;
	}
});

// Start server
app.listen(8080,()=>{console.log('Web server stated at port 8080.')});

// Omit disconnection at Starbucks
setInterval(()=>{log(Date.now());},10000) ;