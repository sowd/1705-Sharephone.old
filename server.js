var fs = require('fs');
var NCMB = require("ncmb");

const ncmbinfo = JSON.parse(fs.readFileSync('ncmbinfo.json').toString()) ;
var ncmb = new NCMB( ncmbinfo.ak,ncmbinfo.ck );

var DB = ncmb.DataStore("JPWikipedia");

var log = console.log ;


function q(word){
	return new Promise((ac,rj)=>{
		DB.in("Key",[word,'['+word+']']).fetchAll().then(re=>{
			switch( re.length ){
			case 0 : rj();		return;
			case 1 : ac(re[0].Vector);	return ;
			case 2 :
				var r = rc[0].Vector.concat() ;
				for( var xi=0;xi<r.length;++xi )
					r[xi] = 0.5 * (r[xi] + rc[1].Vector[x1]) ;
				ac( r ) ;
				return ;
			}
			rj() ;
		}).catch(rj) ;

	}) ;
}

q('ハワイロア').then(v=>{
	log(v) ;
}).catch(()=>{log('No entry found.')});
