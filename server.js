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
				fs.writeFileSync('q_cache.json',JSON.stringify(q_cache)) ;
				return ;
			case 2 :
				var r=[] ;
				for( var xi=0;xi<re[0].Vector.length;++xi )
					r.push( 0.5 * (re[0].Vector[xi] + re[1].Vector[xi]) ) ;
				q_cache[word]=r ;
				fs.writeFileSync('q_cache.json',JSON.stringify(q_cache)) ;
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
var MeCab = new require('mecab-async') , mecab = new MeCab() ;

var txt = remove_unnecessary(fs.readFileSync('data/170322-hinaako.txt').toString()) ;


function parse_sentence( sentence , linecount ){
	var nouns = sentence.filter(w=>(w[1]=='名詞')).map(w=>w[0]) ;

	//log(linecount+':'+nouns.join('') ) ;
	//return ;

	if( nouns.length>0 ){
		Promise.all(nouns.map(w=>{
			return new Promise((ac,rj)=>{
				q(w).then(ac).catch(ac) ;
			}) ;
		})).then(vecs=>{
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
			})
			for( var xi=0;xi<v_av.length;++xi )
				v_av[xi] /= avail_num ;
			log(linecount+':'+nouns.join('') +'=>'+JSON.stringify(v_av) ) ;
		}).catch(re=>{console.error('Word query failed:'+re);})
	}
}

var mecab_analyzed_txt = '' ;

const ignore_ex = new RegExp('\r', 'g'); ;
mecab.parse(txt, function(err, result) {
	if (err) throw err;

	var sentence = [] , nlcount = 0 , linecount = 0 ;
	result.forEach(w=>{
		if( w[0].indexOf('\r')>=0 /*w[0].match(ignore_ex)*/ )
			return ;

		mecab_analyzed_txt += w.join()+"\n" ;

		if( w[0] === 'EOS' ){
			if( ++nlcount == 3){
				parse_sentence(sentence,++linecount) ;
				//log(sentence) ;
				sentence = [] ;
			}
		} else {
			nlcount = 0 ;
			sentence.push(w) ;
		}
	}) ;
	//log(JSON.stringify(sentences)) ;

	fs.writeFile('mecab_analyze_result.txt'
		, mecab_analyzed_txt
		/*, function (err) {
		    console.log(err);
		}*/
	);
});

