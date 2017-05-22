// https://dev.smt.docomo.ne.jp/?p=docs.api.page&api_name=dialogue&p_name=api_1#tag01

const DOCOMO_API_KEY = '4b55795768724642307363745369323466746a4f6b6536676f682e624d6f70486d6d316d30447744355830' ;
const DOCOMO_REQ_URL = 'https://api.apigw.smt.docomo.ne.jp/dialogue/v1/dialogue?APIKEY='+DOCOMO_API_KEY ;

class Bot {
  constructor(botname,tgtname) {
  	this.name = botname ;
  	this.tgtname = tgtname ;
  }
  talk(q_if_exist){
  	return new Promise((ac,rj)=>{
		$.ajax({
			url:DOCOMO_REQ_URL
			,type:'POST'
			,data:JSON.stringify({
				utt:q_if_exist
				, context:this.context
				, nickname:this.name
				, t:20	// なし:デフォルトキャラ 20:関西弁, 30:赤ちゃん
				, birthdateY:2000
				, birthdateM:1
				, birthdateD:1
				, age:17
				, constellations:'山羊座'
				, place:'千葉'
				, 
			})
			,contentType:'application/json; charset=utf-8'
			,dataType:'json'
			,success:re=>{
				this.context = re.context ;
				ac(re.utt) ;
			}
		});

	}) ;
  }
}
