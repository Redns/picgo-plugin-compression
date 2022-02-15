var request = require('request')
var fs = require('fs')
var superagent = require('superagent')

var options = {
    'method': 'GET',
    'url': 'https://www.secaibi.com/designtools/api/image/20220215171832-resizer-1-dc9243a5.bin?filename=testImage.png&browser=',
    'headers': {
        'Referer': 'https://www.secaibi.com/designtools/media/pages/resizer.html'
    }
}

// request(options, function (error, response) {
//     console.log(response.body)
//     var imageBuffer = Buffer.from(response.body, 'ascii')
//     fs.writeFile('./src/test.png', imageBuffer, function(err){
//         if(err){
//             console.log(err)
//         }
//     })
// })

async function getData() {
    try {
        let res = await superagent
            .get('https://www.secaibi.com/designtools/api/image/20220215171832-resizer-1-dc9243a5.bin?filename=testImage.png&browser=')
            .set("Content-Type", "application/json")
            .set("accept", "application/octet-stream")
            .buffer(true).disableTLSCerts()
        fs.writeFile('./src/test.png', res.body, function(err){
            console.log(err)
        })
    }
    catch(error) {
        console.log("error " + error)
    }
}

getData()