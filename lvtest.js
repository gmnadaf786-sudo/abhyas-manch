/* विद्यार्थी स्तर – प्रत्यक्ष टेस्ट (शाळा भेट फॉर्म, visit.js वापरते).
   विद्यार्थ्याला मोबाईलवरील मजकूर वाचायला / गणिते सोडवायला सांगा; बरोबर असेल तर त्या आयटमवर टिचकी द्या.
   इयत्तेनुसार सुरुवातीचा टप्पा (१–२: अक्षरे, ३–५: शब्द, ६–८: वाक्य); पास झाल्यास पुढचा, नापास झाल्यास मागचा टप्पा — शेवटी स्तर आपोआप ठरतो
   व वरील ड्रॉपडाऊनमध्ये भरला जातो. सर्व नावे lvt ने सुरू होतात. */
var LVT=null;
var LVTC={
 mr:{L:'क ख ग घ च ज झ त द ध न प ब भ म य र ल व श स ह ळ ट ड ठ'.split(' '),
  W:[ 'आई बाबा घर पाणी फूल कमळ चेंडू पतंग भाकरी शाळा आंबा मासा केळी बैल गाय झाड नदी पुस्तक दप्तर'.split(' '),'मित्र शेतकरी विद्यार्थी अभ्यास परीक्षा स्वच्छता ग्रंथालय पर्यावरण प्रामाणिक निसर्ग सहल उत्सव किल्ला मैदान शिक्षक कष्टकरी बाजारपेठ पाऊस'.split(' '),'संघर्ष स्वातंत्र्य उद्योगधंदा महत्त्वाकांक्षा संविधान सहकार्य संशोधन प्रयत्नशील पर्वतरांग अर्थव्यवस्था लोकशाही जबाबदारी'.split(' ')],
  S:[['आई रोज सकाळी लवकर उठते.','मी रोज शाळेत जातो.','आमच्या घरी एक गाय आहे.','बाबा शेतात काम करतात.','झाडावर पक्षी बसला आहे.','आज आकाशात ढग आहेत.'],['आमच्या गावात दर शनिवारी आठवडी बाजार भरतो.','पावसाळ्यात नदीला मोठा पूर आला.','आम्ही सर्व मित्र मैदानावर क्रिकेट खेळतो.','सकाळी लवकर उठल्याने अभ्यासात मन लागते.','शिक्षकांनी आम्हाला झाडे लावायला सांगितले.'],['स्वच्छता ही केवळ एक सवय नसून ती आपली जबाबदारी आहे.','भारताचे संविधान सर्व नागरिकांना समान हक्क देते.','कठोर परिश्रम केल्याशिवाय यश मिळत नाही.','पर्यावरणाचे रक्षण करणे ही आपली सर्वांची जबाबदारी आहे.','शेतकरी कष्ट करून आपल्या सर्वांसाठी अन्नधान्य पिकवतो.']],
  T:['एक होता कावळा. त्याला खूप तहान लागली होती. त्याने पाणी शोधले. त्याला एक माठ दिसला. माठात थोडेच पाणी होते. कावळ्याने त्यात छोटे दगड टाकले. पाणी वर आले. कावळ्याने पाणी प्यायले.','रामपूर गावात एक शेतकरी राहत होता. तो रोज पहाटे उठून शेतात जायचा. एका वर्षी पाऊस वेळेवर आला नाही. तरीही त्याने हार मानली नाही. त्याने विहिरीचे पाणी देऊन पीक वाचवले. शेवटी त्याला चांगले उत्पन्न मिळाले.','विज्ञानाच्या प्रगतीमुळे आपले जीवन अधिक सुखकर झाले आहे. मात्र त्याचा वापर जबाबदारीने करणे आवश्यक आहे. प्लास्टिकच्या अतिवापरामुळे पर्यावरणाचे नुकसान होत आहे. म्हणून प्रत्येकाने कापडी पिशवीचा वापर करावा आणि कचरा योग्य ठिकाणी टाकावा.']},
 kn:{L:'ಕ ಖ ಗ ಘ ಚ ಜ ಝ ತ ದ ಧ ನ ಪ ಬ ಭ ಮ ಯ ರ ಲ ವ ಶ ಸ ಹ ಳ ಟ ಡ'.split(' '),
  W:['ಅಮ್ಮ ಅಪ್ಪ ಮನೆ ನೀರು ಹೂವು ಕಮಲ ಚೆಂಡು ಗಾಳಿಪಟ ರೊಟ್ಟಿ ಶಾಲೆ ಮಾವು ಮೀನು ಬಾಳೆ ಎತ್ತು ಹಸು ಮರ ನದಿ ಪುಸ್ತಕ ಚೀಲ'.split(' '),'ಸ್ನೇಹಿತ ರೈತ ವಿದ್ಯಾರ್ಥಿ ಅಭ್ಯಾಸ ಪರೀಕ್ಷೆ ಸ್ವಚ್ಛತೆ ಗ್ರಂಥಾಲಯ ಪರಿಸರ ಪ್ರಾಮಾಣಿಕ ಪ್ರಕೃತಿ ಪ್ರವಾಸ ಹಬ್ಬ ಕೋಟೆ ಮೈದಾನ ಶಿಕ್ಷಕ ಮಳೆ ಸಂತೆ'.split(' '),'ಹೋರಾಟ ಸ್ವಾತಂತ್ರ್ಯ ಕೈಗಾರಿಕೆ ಮಹತ್ವಾಕಾಂಕ್ಷೆ ಸಂವಿಧಾನ ಸಹಕಾರ ಸಂಶೋಧನೆ ಪರ್ವತಶ್ರೇಣಿ ಅರ್ಥವ್ಯವಸ್ಥೆ ಪ್ರಜಾಪ್ರಭುತ್ವ ಜವಾಬ್ದಾರಿ'.split(' ')],
  S:[['ಅಮ್ಮ ದಿನಾ ಬೆಳಿಗ್ಗೆ ಬೇಗ ಏಳುತ್ತಾರೆ.','ನಾನು ಪ್ರತಿದಿನ ಶಾಲೆಗೆ ಹೋಗುತ್ತೇನೆ.','ನಮ್ಮ ಮನೆಯಲ್ಲಿ ಒಂದು ಹಸು ಇದೆ.','ಅಪ್ಪ ಹೊಲದಲ್ಲಿ ಕೆಲಸ ಮಾಡುತ್ತಾರೆ.','ಮರದ ಮೇಲೆ ಹಕ್ಕಿ ಕುಳಿತಿದೆ.','ಇಂದು ಆಕಾಶದಲ್ಲಿ ಮೋಡಗಳಿವೆ.'],['ನಮ್ಮ ಊರಿನಲ್ಲಿ ಪ್ರತಿ ಶನಿವಾರ ಸಂತೆ ನಡೆಯುತ್ತದೆ.','ಮಳೆಗಾಲದಲ್ಲಿ ನದಿಗೆ ದೊಡ್ಡ ಪ್ರವಾಹ ಬಂತು.','ನಾವು ಎಲ್ಲಾ ಸ್ನೇಹಿತರು ಮೈದಾನದಲ್ಲಿ ಕ್ರಿಕೆಟ್ ಆಡುತ್ತೇವೆ.','ಬೆಳಿಗ್ಗೆ ಬೇಗ ಎದ್ದರೆ ಓದಲು ಮನಸ್ಸು ಬರುತ್ತದೆ.','ಶಿಕ್ಷಕರು ನಮಗೆ ಗಿಡಗಳನ್ನು ನೆಡಲು ಹೇಳಿದರು.'],['ಸ್ವಚ್ಛತೆ ಕೇವಲ ಅಭ್ಯಾಸವಲ್ಲ, ಅದು ನಮ್ಮ ಜವಾಬ್ದಾರಿ.','ಭಾರತದ ಸಂವಿಧಾನವು ಎಲ್ಲಾ ನಾಗರಿಕರಿಗೆ ಸಮಾನ ಹಕ್ಕುಗಳನ್ನು ನೀಡುತ್ತದೆ.','ಕಠಿಣ ಪರಿಶ್ರಮವಿಲ್ಲದೆ ಯಶಸ್ಸು ದೊರೆಯುವುದಿಲ್ಲ.','ಪರಿಸರವನ್ನು ರಕ್ಷಿಸುವುದು ನಮ್ಮೆಲ್ಲರ ಜವಾಬ್ದಾರಿ.','ರೈತ ಕಷ್ಟಪಟ್ಟು ನಮ್ಮೆಲ್ಲರಿಗಾಗಿ ಆಹಾರಧಾನ್ಯ ಬೆಳೆಯುತ್ತಾನೆ.']],
  T:['ಒಂದು ಕಾಗೆ ಇತ್ತು. ಅದಕ್ಕೆ ತುಂಬಾ ಬಾಯಾರಿಕೆಯಾಗಿತ್ತು. ಅದು ನೀರನ್ನು ಹುಡುಕಿತು. ಅದಕ್ಕೆ ಒಂದು ಗಡಿಗೆ ಕಾಣಿಸಿತು. ಗಡಿಗೆಯಲ್ಲಿ ಸ್ವಲ್ಪವೇ ನೀರಿತ್ತು. ಕಾಗೆ ಅದರಲ್ಲಿ ಸಣ್ಣ ಕಲ್ಲುಗಳನ್ನು ಹಾಕಿತು. ನೀರು ಮೇಲೆ ಬಂತು. ಕಾಗೆ ನೀರು ಕುಡಿಯಿತು.','ರಾಮಪುರ ಗ್ರಾಮದಲ್ಲಿ ಒಬ್ಬ ರೈತ ವಾಸಿಸುತ್ತಿದ್ದನು. ಅವನು ಪ್ರತಿದಿನ ಬೆಳಿಗ್ಗೆ ಎದ್ದು ಹೊಲಕ್ಕೆ ಹೋಗುತ್ತಿದ್ದನು. ಒಂದು ವರ್ಷ ಮಳೆ ಸರಿಯಾದ ಸಮಯಕ್ಕೆ ಬರಲಿಲ್ಲ. ಆದರೂ ಅವನು ಹೆದರಲಿಲ್ಲ. ಬಾವಿಯ ನೀರು ಹಾಕಿ ಬೆಳೆಯನ್ನು ಉಳಿಸಿದನು. ಕೊನೆಗೆ ಒಳ್ಳೆಯ ಇಳುವರಿ ಸಿಕ್ಕಿತು.','ವಿಜ್ಞಾನದ ಪ್ರಗತಿಯಿಂದ ನಮ್ಮ ಜೀವನ ಹೆಚ್ಚು ಸುಲಭವಾಗಿದೆ. ಆದರೆ ಅದನ್ನು ಜವಾಬ್ದಾರಿಯಿಂದ ಬಳಸುವುದು ಅಗತ್ಯ. ಪ್ಲಾಸ್ಟಿಕ್‌ನ ಅತಿಯಾದ ಬಳಕೆಯಿಂದ ಪರಿಸರಕ್ಕೆ ಹಾನಿಯಾಗುತ್ತಿದೆ. ಆದ್ದರಿಂದ ಪ್ರತಿಯೊಬ್ಬರೂ ಬಟ್ಟೆಯ ಚೀಲ ಬಳಸಬೇಕು ಮತ್ತು ಕಸವನ್ನು ಸರಿಯಾದ ಸ್ಥಳದಲ್ಲಿ ಹಾಕಬೇಕು.']},
 en:{C:'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),Sm:'abcdefghijklmnopqrstuvwxyz'.split(''),
  W:['cat dog sun book pen bag milk tree fish ball'.split(' '),'school friend window garden market village teacher water mango river'.split(' '),'environment discipline knowledge important beautiful tomorrow different library'.split(' ')],
  S:[['I have a red ball.','This is my school bag.','The cat sat on the mat.','We go to school daily.'],['My mother cooks food every morning.','We play cricket in the ground after school.','The farmer works in the field all day.','Birds fly high in the sky.'],['Reading books every day improves our knowledge.','We should keep our environment clean and green.','Honesty is the best policy in life.','The library is open from morning till evening.']]}};
var LVTG={mr:[['आमच्या शाळेत आज वनमहोत्सव साजरा झाला. सर्व मुलांनी एकेक रोप लावले. शिक्षकांनी सांगितले, "झाडे आपल्याला सावली, फळे आणि शुद्ध हवा देतात." आम्ही रोपांना रोज पाणी घालण्याचे ठरवले.','मुलांनी काय लावले?','रोप'],['गणेश रोज सकाळी वर्तमानपत्र वाटण्याचे काम करतो. त्यानंतर तो शाळेत जातो. या कामामुळे त्याला पैशाची किंमत कळली. त्याने जमवलेल्या पैशांतून आईसाठी चष्मा घेतला. आईला खूप आनंद झाला.','गणेशने जमवलेल्या पैशांतून काय घेतले?','आईसाठी चष्मा'],['आधुनिक काळात मोबाईलचा वापर झपाट्याने वाढला आहे. त्यामुळे माहिती मिळवणे सोपे झाले, परंतु अतिवापरामुळे डोळ्यांचे आणि एकाग्रतेचे प्रश्न निर्माण होत आहेत. म्हणून अभ्यासासाठी आवश्यक तेवढाच वापर करणे हितकारक ठरते.','मोबाईलच्या अतिवापराने कोणते प्रश्न निर्माण होतात?','डोळ्यांचे व एकाग्रतेचे']],
 kn:[['ನಮ್ಮ ಶಾಲೆಯಲ್ಲಿ ಇಂದು ವನಮಹೋತ್ಸವ ಆಚರಿಸಿದರು. ಎಲ್ಲಾ ಮಕ್ಕಳು ಒಂದೊಂದು ಗಿಡ ನೆಟ್ಟರು. ಶಿಕ್ಷಕರು ಹೇಳಿದರು, "ಮರಗಳು ನಮಗೆ ನೆರಳು, ಹಣ್ಣು ಮತ್ತು ಶುದ್ಧ ಗಾಳಿ ಕೊಡುತ್ತವೆ." ನಾವು ಗಿಡಗಳಿಗೆ ದಿನಾ ನೀರು ಹಾಕಲು ನಿರ್ಧರಿಸಿದೆವು.','ಮಕ್ಕಳು ಏನು ನೆಟ್ಟರು?','ಗಿಡ'],['ಗಣೇಶ ಪ್ರತಿದಿನ ಬೆಳಿಗ್ಗೆ ಪತ್ರಿಕೆ ಹಂಚುವ ಕೆಲಸ ಮಾಡುತ್ತಾನೆ. ನಂತರ ಅವನು ಶಾಲೆಗೆ ಹೋಗುತ್ತಾನೆ. ಈ ಕೆಲಸದಿಂದ ಅವನಿಗೆ ಹಣದ ಬೆಲೆ ಗೊತ್ತಾಯಿತು. ಉಳಿಸಿದ ಹಣದಿಂದ ಅವನು ತಾಯಿಗೆ ಕನ್ನಡಕ ಕೊಡಿಸಿದನು. ತಾಯಿಗೆ ತುಂಬಾ ಖುಷಿಯಾಯಿತು.','ಗಣೇಶ ಉಳಿಸಿದ ಹಣದಿಂದ ಏನು ಕೊಡಿಸಿದನು?','ತಾಯಿಗೆ ಕನ್ನಡಕ'],['ಆಧುನಿಕ ಕಾಲದಲ್ಲಿ ಮೊಬೈಲ್ ಬಳಕೆ ವೇಗವಾಗಿ ಹೆಚ್ಚಾಗಿದೆ. ಇದರಿಂದ ಮಾಹಿತಿ ಪಡೆಯುವುದು ಸುಲಭವಾಯಿತು, ಆದರೆ ಅತಿಯಾದ ಬಳಕೆಯಿಂದ ಕಣ್ಣಿನ ಮತ್ತು ಏಕಾಗ್ರತೆಯ ಸಮಸ್ಯೆಗಳು ಉಂಟಾಗುತ್ತಿವೆ. ಆದ್ದರಿಂದ ಓದಿಗೆ ಬೇಕಾದಷ್ಟೇ ಬಳಸುವುದು ಒಳ್ಳೆಯದು.','ಮೊಬೈಲ್ ಅತಿಯಾದ ಬಳಕೆಯಿಂದ ಯಾವ ಸಮಸ್ಯೆಗಳು ಉಂಟಾಗುತ್ತವೆ?','ಕಣ್ಣಿನ ಮತ್ತು ಏಕಾಗ್ರತೆಯ ಸಮಸ್ಯೆಗಳು']],
 en:[['Our school had a tree plantation day today. Every child planted one sapling. The teacher said, "Trees give us shade, fruits and fresh air." We decided to water the plants daily.','What did the children plant?','Saplings'],['Ganesh delivers newspapers every morning before going to school. This work taught him the value of money. With the money he saved, he bought spectacles for his mother. She was very happy.','What did Ganesh buy for his mother?','Spectacles'],['Mobile phones have become a part of our daily life. They help us find information quickly, but too much use can harm our eyes and reduce our attention. Therefore, we should use them only as much as needed for study.','What can too much use of mobile phones harm?','Eyes and attention']]};
/* इयत्तेनुसार संख्या वाचन: अंकांची संख्या (इयत्ता → अंक). बदलायचे असल्यास येथे बदला. */
var LVTD={1:3,2:3,3:4,4:5,5:7,6:8,7:9,8:9};
function lvtGrade(f,c){c=+c||1;if(f==='m'){var d=LVTD[c]||3;return 'इयत्ता '+c+' स्तर: '+d+' अंकी संख्या वाचतो'}return 'इयत्ता '+c+' स्तर: इयत्तेच्या पातळीचा उतारा अस्खलित वाचतो व अर्थ सांगतो'}
function lvtNum(d){var s=String(lvtRn(1,9));for(var i=1;i<d;i++)s+=lvtRn(0,9);return s}
function lvtPick(a,n){var b=a.slice(),r=[];while(r.length<n&&b.length)r.push(b.splice(Math.floor(Math.random()*b.length),1)[0]);return r}
function lvtRn(a,b){return a+Math.floor(Math.random()*(b-a+1))}
function lvtBand(c){c=+c||0;return c<=2?0:c<=5?1:2}
/* टप्पा तयार करणे: {t: सूचना, it:[{x:मजकूर, a:उत्तर(ऐच्छिक)}], need:किमान बरोबर, big:मोठ्या अक्षरात, one:एक ओळ} */
function lvtStage(f,s,c,lang){var b=lvtBand(c),C=LVTC[lang]||LVTC.mr,E=LVTC.en,r;
 if(f==='l'){
  if(s===1)return{t:'अक्षरे ओळखणे — प्रत्येक अक्षर वाचायला सांगा',it:lvtPick(C.L,5).map(function(x){return{x:x}}),need:4,big:1};
  if(s===2)return{t:'शब्द वाचन — प्रत्येक शब्द वाचायला सांगा',it:lvtPick(C.W[b],5).map(function(x){return{x:x}}),need:3,big:1};
  if(s===3)return{t:'वाक्य वाचन — प्रत्येक वाक्य वाचायला सांगा',it:lvtPick(C.S[b],3).map(function(x){return{x:x}}),need:2,one:1};
  if(s===4)return{t:'गोष्ट / उतारा — अडखळत न थांबता वाचायला सांगा',it:[{x:C.T[b]}],need:1,one:1,lab:'अस्खलित वाचले'};
  return lvtGS(lang,b,c)}
 if(f==='e'){
  if(s===1)return{t:'Capital letters — प्रत्येक अक्षर ओळखायला सांगा',it:lvtPick(E.C,5).map(function(x){return{x:x}}),need:4,big:1};
  if(s===2)return{t:'Small letters — प्रत्येक अक्षर ओळखायला सांगा',it:lvtPick(E.Sm,5).map(function(x){return{x:x}}),need:4,big:1};
  if(s===3)return{t:'Words — प्रत्येक शब्द वाचायला सांगा',it:lvtPick(E.W[b],5).map(function(x){return{x:x}}),need:3,big:1};
  if(s===4)return{t:'Sentences — प्रत्येक वाक्य वाचायला सांगा',it:lvtPick(E.S[b],3).map(function(x){return{x:x}}),need:2,one:1};
  return lvtGS('en',b,c)}
 if(s===1)return{t:'१ ते ९ संख्या — प्रत्येक संख्या ओळखायला (वाचायला) सांगा',it:lvtPick([1,2,3,4,5,6,7,8,9],5).map(function(x){return{x:String(x)}}),need:4,big:1};
 if(s===2)return{t:'१० ते ९९ संख्या — प्रत्येक संख्या वाचायला सांगा',it:lvtPick((function(){var a=[];for(var i=10;i<=99;i++)if(i%10)a.push(i);return a})(),5).map(function(x){return{x:String(x)}}),need:4,big:1};
 if(s===3){r=[];while(r.length<3){var a=lvtRn(31,95),bb=lvtRn(12,a-6);if(bb%10>a%10&&a-bb>=5&&!r.some(function(q){return q.x===a+' − '+bb}))r.push({x:a+' − '+bb,a:String(a-bb)})}return{t:'वजाबाकी — सोडवायला सांगा (उत्तर खाली दिले आहे)',it:r,need:2,big:1}}
 if(s===4){r=[];while(r.length<3){var d=lvtRn(2,9),q=lvtRn(Math.ceil(100/d),Math.floor(999/d)),n=d*q;if(!r.some(function(z){return z.x===n+' ÷ '+d}))r.push({x:n+' ÷ '+d,a:String(q)})}
 return{t:'भागाकार — सोडवायला सांगा (उत्तर खाली दिले आहे)',it:r,need:2,big:1}}
 var D=LVTD[+c]||3;return{t:'इयत्ता '+c+' स्तर — '+D+' अंकी संख्या वाचायला सांगा',it:[1,2,3].map(function(){return{x:lvtNum(D)}}),need:2,big:1,sm:D>=7}}
function lvtGS(lang,b,c){var g=(LVTG[lang]||LVTG.mr)[b];return{t:'इयत्ता '+c+' स्तर — उतारा अस्खलित वाचायला सांगा, मग प्रश्न विचारा',it:[{x:g[0],lab:'अस्खलित वाचले'},{x:g[1],a:g[2],lab:'योग्य उत्तर दिले'}],need:2,one:1}}
var LVTN={l:'भाषा वाचन',m:'गणित',e:'इंग्रजी वाचन'};
function lvtGo(pen,f){var x=(VZCX.ro||[]).filter(function(r){return r.p===pen})[0];if(!x)return;var lang=x.med==='kn'?'kn':'mr';
 var s0=[1,2,3][lvtBand(x.c)];LVT={pen:pen,f:f,n:x.n,c:x.c,lang:lang,s:s0,mode:'start',best:0,trail:[],mk:{},st:null,done:null};lvtNew();lvtDraw()}
function lvtNew(){LVT.st=lvtStage(LVT.f,LVT.s,LVT.c,LVT.lang);LVT.mk={}}
function lvtOv(){var e=document.getElementById('lvt');if(!e){e=document.createElement('div');e.id='lvt';e.style.cssText='position:fixed;inset:0;z-index:200;background:var(--bg);overflow:auto;padding:12px';document.body.appendChild(e)}return e}
function lvtCnt(){var n=0;for(var k in LVT.mk)if(LVT.mk[k])n++;return n}
function lvtDraw(){var e=lvtOv(),S=LVT.st,h='<div style="max-width:720px;margin:0 auto"><div class="card"><div style="display:flex;gap:8px;align-items:center"><b style="flex:1">📝 '+esc(LVT.n)+' — '+LVTN[LVT.f]+' टेस्ट</b><button class="g" style="width:auto;margin:0;padding:6px 12px" onclick="lvtClose()">✖ रद्द</button></div>';
 if(LVT.f==='l')h+='<div class="row" style="margin-top:8px"><button class="'+(LVT.lang==='mr'?'':'g')+'" style="min-width:0" onclick="lvtLang(\'mr\')">मराठी</button><button class="'+(LVT.lang==='kn'?'':'g')+'" style="min-width:0" onclick="lvtLang(\'kn\')">ಕನ್ನಡ</button></div>';
 if(LVT.trail.length)h+='<p class="m" style="margin:6px 0 0">झालेले टप्पे: '+LVT.trail.map(function(t){return t.s+(t.p?' ✔':' ✘')}).join(' · ')+'</p>';h+='</div>';
 if(LVT.done!==null){var L=VZLV[LVT.f],lv=LVT.done;h+='<div class="card"><h2>निकाल</h2><p style="font-size:18px;margin:0 0 10px"><b>'+(lv+1)+'. '+esc(lv===5?lvtGrade(LVT.f,LVT.c):L[lv])+'</b></p><p class="m">असा स्तर नोंदवायचा?</p><div class="row"><button onclick="lvtSave()">✔ हा स्तर जतन करा</button><button class="g" onclick="lvtClose()">रद्द</button></div></div></div>';e.innerHTML=h;return}
 h+='<div class="card"><h2>टप्पा '+LVT.s+' / 5</h2><p class="m" style="margin:0 0 8px">'+S.t+'<br>बरोबर वाचले / सोडवले तर त्यावर <b>टिचकी द्या</b> (हिरवे होईल).</p>';
 h+=S.it.map(function(it,i){var on=LVT.mk[i];return '<button type="button" onclick="lvtTog('+i+')" style="display:block;text-align:'+(S.big?'center':'left')+';margin:0 0 8px;padding:'+(S.big?'16px':'12px')+';font-size:'+(S.big?(S.sm?'28px':'34px'):S.one&&it.x.length>120?'20px':'22px')+';line-height:1.5;background:'+(on?'#15803d':'var(--c)')+';color:'+(on?'#fff':'var(--i)')+';border:2px solid '+(on?'#15803d':'var(--l)')+'">'+esc(it.x)+(it.a?'<div style="font-size:13px;opacity:.7">उत्तर: '+esc(it.a)+'</div>':'')+(S.lab?'<div style="font-size:13px;opacity:.7">'+S.lab+(on?' ✔':' (दाबा)')+'</div>':'')+'</button>'}).join('');
 h+='<p id="lvtc" style="margin:4px 0 8px"></p><div class="row"><button onclick="lvtNext()">पुढे →</button><button class="g" onclick="lvtNew();lvtDraw()">🔄 दुसरे आयटम</button></div></div></div>';e.innerHTML=h;lvtCt()}
function lvtCt(){var e=document.getElementById('lvtc');if(e){var n=lvtCnt(),ok=n>=LVT.st.need;e.innerHTML='बरोबर: <b style="color:'+(ok?'#15803d':'#b91c1c')+'">'+n+' / '+LVT.st.it.length+'</b> <span class="m">(टप्पा पास होण्यासाठी किमान '+LVT.st.need+')</span>'}}
function lvtTog(i){LVT.mk[i]=!LVT.mk[i];lvtDraw()}
function lvtLang(l){LVT.lang=l;lvtNew();lvtDraw()}
function lvtNext(){var p=lvtCnt()>=LVT.st.need;LVT.trail.push({s:LVT.s,p:p});
 if(LVT.mode==='start'){if(p){LVT.best=LVT.s;if(LVT.s>=5)return lvtEnd(5);LVT.mode='up';LVT.s++}else{LVT.mode='down';if(LVT.s<=1)return lvtEnd(0);LVT.s--}}
 else if(LVT.mode==='up'){if(p){LVT.best=LVT.s;if(LVT.s>=5)return lvtEnd(5);LVT.s++}else return lvtEnd(LVT.best)}
 else{if(p)return lvtEnd(LVT.s);if(LVT.s<=1)return lvtEnd(0);LVT.s--}
 lvtNew();lvtDraw()}
function lvtEnd(l){LVT.done=l;lvtDraw()}
function lvtSave(){if(!LVT)return;var pen=LVT.pen,f=LVT.f,l=LVT.done;lvtClose();vzLv(pen,f,String(l));vzLvL()}
function lvtClose(){var e=document.getElementById('lvt');if(e)e.remove();LVT=null}
