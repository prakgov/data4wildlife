
const GoogleTranslateAPIkey = 'Ask Alastair Jamieson'

$(document).ready(() => {
	// jQuery.ready

	// event handler for when the import filename changes
	$('#fileinput').off().on('change', ()=>{

		input = document.getElementById('fileinput')

		loadFile((fname, json)=>{
			let ht = fname.slice(0,fname.lastIndexOf('-'))
			console.log(ht, json, json.code)

			if(json.code === 404) {
				Swal.fire('No data', 'The API could not find posts for the hashtag <br><br> #'+ht, 'info')
				input.value = ''
				return;
			}

			$('.table').show()

			populateTable(ht, json.data)

			input.value = ''
		})
	})

	// event handler for the import button
	$('#import').off().click(async ()=>{

		$('#fileinput').trigger('click')

	})

	// event handler for the export button
	$('#export').off().click(()=>{

		if(Object.keys(taggedPosts).length === 0) {
			Swal.fire('No tagged posts', 'Please tag some posts as potential IWT', 'warning')
		}
		else {
			convertTaggedPostsToCSV(taggedPosts)
		}

	})

})

// global data objects
let filename = ''
let hashtag = ''
let allData = null
let taggedPosts = {}

// throttle Google Translate API requests to no more than 10 per second
let translateQueue = []
setInterval(() => {
	if(translateQueue.length > 0) {

		let queueItem = translateQueue.shift()
		translateText(queueItem.text, queueItem.id)

	}
},100)

const translateText = (text, id) => {
	console.log('# translating '+text+' for ID '+id)

	// dodging CORS from the browser, see https://github.com/Rob--W/cors-anywhere
	const proxyurl = 'https://cors-anywhere.herokuapp.com/'
	const url = 'https://translation.googleapis.com/language/translate/v2?target=en&key='+GoogleTranslateAPIkey+'&q='+encodeURIComponent(text) // site that doesn’t send Access-Control-*

	$.get(proxyurl+url, (response, textStatus) => {
		console.log(response)
		let translation = response.data.translations[0]

		// add the translation to the UI
		$('#translated-'+id).html('<small>[from '+translation.detectedSourceLanguage+'] '+translation.translatedText+'</small>')

		// add the translation to allData
		let dataIndex = allData.findIndex((item) => { return item.short_code === id })
		if(dataIndex !== -1) allData[dataIndex].translatedCaption = '[from '+translation.detectedSourceLanguage+'] '+translation.translatedText

	})

}

const populateTable = (ht, d) => {

	hashtag = ht
	allData = d
	taggedPosts = {}


	$('#tableBody').html('')

	allData.forEach(post => {
		// console.log(item)

		let imgUrl = 'hashtags/'+hashtag+'/'+post.short_code+'.jpg'

		let html = '<tr>'
		html += '<td><img id="photo-'+imgUrl+'" class="img-fluid" src="'+imgUrl+'"></td>'
		html += '<td id="caption-'+post.short_code+'"><small>'+post.caption+'</small></td>'
		html += '<td id="translated-'+post.short_code+'"></td>'
		html += '<td><button type="button" class="btn btn-info tag" id="post-'+post.short_code+'">IWT</button></td>'
		html += '</tr>'

		$('#tableBody').append(html)

		// queue the translation
		translateQueue.push( { text:post.caption, id:post.short_code } )
	})

	// add click events to images to show larger version
	$('.img-fluid').off().click((e)=>{
		let id = e.target.id
		console.log(id)
		Swal.fire({
			imageUrl: id.slice(6),
			imageWidth: 500
		})
	})

	// add click events to 'IWT' tag buttons
	$('.tag').off().click((e)=>{
		let id = e.target.id
		console.log(id)

		if(taggedPosts[id]) {
			// this was tagged
			console.log('# untagged')
			delete taggedPosts[id]
			$('#'+id).removeClass('btn-danger').addClass('btn-info')
		}
		else {
			let dataIndex = allData.findIndex((item) => { return item.short_code === id.split('-')[1] })
			if(dataIndex !== -1) {
				console.log('# tagged')
				taggedPosts[id] = allData[dataIndex]
				$('#'+id).removeClass('btn-info').addClass('btn-danger')
			}
		}

	})

}

const convertTaggedPostsToCSV = (posts) => {

	// Platform, Poting URL, MediaFolderName, posterName, #likes, postingTime
	// collectingTime, posterURL, content/text, translatd text, evidence of trade terms
	// emojis, other unspecified evidence, geo location tag, any key words

	let headers = {
		platform: 'Platform',
		mediaFilename: 'Media Filename',
		postingURL: 'Posting URL',
		postingTime: 'Posting Time',
		posterName: 'Poster Name',
		posterURL: 'Poster URL',
		likes: 'Likes',
		collectingTime: 'Collecting time',
		text: 'Content/text',
		translatedText: 'Translated Content/text',
		evidenceIWT: 'Evidence of Trade Terms',
		emojis: 'Emojis',
		otherEvidence: 'Other Unspecified Evidence',
		geoLocation: 'Geo location tag',
		keywords: 'Any keywords'
	}

	let csvData = []

	let collectingISOtimestamp = (new Date()).toISOString().slice(0,19).replace('T', ' ')+'Z'

	for(postId in posts) {

		let post = posts[postId]
		console.log(post)

		csvData.push({
			platform: 'Instagram',
			mediaFilename: '/scripts/hashtags/'+hashtag+'/'+post.short_code+'.jpg',
			postingURL: post.post_url,
			postingTime: post.created_time.string,
			posterName: 'InstagramID:'+post.owner.id,
			posterURL: 'InstagramID:'+post.owner.id,
			likes: post.figures.likes_count,
			collectingTime: collectingISOtimestamp,
			text: post.caption.replace(/(\r\n|\n|\r)/gm, ' ').replace(/"/gm, "'"), // remove linebreaks and convert " to '
			translatedText: post.translatedCaption.replace(/(\r\n|\n|\r)/gm, ' ').replace(/"/gm, "'"), // remove linebreaks and commas and convert " to '
			evidenceIWT: 'manually verified',
			emojis: extractEmojis(post.caption),
			otherEvidence: 'none',
			geoLocation: post.location.name,
			keywords: '#'+hashtag
		})

	}

	console.log(csvData)

	exportCSVFile(headers, csvData, 'IWT-for-hashtag-'+hashtag)

}

// for MM/DD/YYYY use this from https://stackoverflow.com/questions/11591854/format-date-to-mm-dd-yyyy-in-javascript#answer-15764763
const getFormattedDate = (date) => {
    let year = date.getFullYear();
    let month = (1 + date.getMonth()).toString().padStart(2, '0');
    let day = date.getDate().toString().padStart(2, '0');

    return month + '/' + day + '/' + year;
}

// from https://davidwalsh.name/emoji-regex
const extractEmojis = (text) => {

	let emojis = text.match(/\p{Emoji_Presentation}+/gu)

	return (emojis === null) ? '' : emojis.join('').replace(/#/g,'')

}

const exportData = () => {

	exportCSVFile(headers, itemsFormatted, fileTitle)

}

const unicodeToChar = (text) => {

	return text.replace(/\\u[\dA-F]{4}/gi,
		function (match) {
			return String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16))
		});

}


// from https://medium.com/@danny.pule/export-json-to-csv-file-using-javascript-a0b7bc5b00d2

const convertToCSV = (objArray) => {
  var array = typeof objArray != 'object' ? JSON.parse(objArray) : objArray
  var str = ''

  for (var i = 0; i < array.length; i++) {
    var line = ''
    for (var index in array[i]) {
      if (line != '') line += ','
      line += '"'+array[i][index]+'"';
    }
    str += line + '\r\n'
  }

  return str
}

const exportCSVFile = (headers, items, fileTitle) => {
  if (headers) {
    items.unshift(headers)
  }

  // Convert Object to JSON
  var jsonObject = JSON.stringify(items)
  var csv = convertToCSV(jsonObject)
  var exportedFilenmae = fileTitle + '.csv' || 'export.csv'

  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  if (navigator.msSaveBlob) { // IE 10+
    navigator.msSaveBlob(blob, exportedFilenmae)
  } else {
    var link = document.createElement("a");
    if (link.download !== undefined) { // feature detection
      // Browsers that support HTML5 download attribute
      var url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      link.setAttribute("download", exportedFilenmae)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click();
      document.body.removeChild(link)
    }
  }
}

// from https://stackoverflow.com/questions/7346563/loading-local-json-file#answer-21446426

const loadFile = (callback) => {
	var input, file, fr

	if (typeof window.FileReader !== 'function') {
		Swal.fire('Old browser', 'Reading local files is not supported on this browser yet. Please try another browser', 'warning')
		return
	}

	input = document.getElementById('fileinput')
	if (!input) {
		alert("Um, couldn't find the fileinput element.")
	}
	else if (!input.files) {
		alert("This browser doesn't seem to support the `files` property of file inputs.")
	}
	else if (!input.files[0]) {
		Swal.fire('No file selected', 'Please select a JSON file generated by the data sourcing script', 'warning')
	}
	else {
		file = input.files[0]
		fr = new FileReader()
		fr.onload = receivedText
		fr.readAsText(file)
	}

	function receivedText(e) {
		let lines = e.target.result
		var data = JSON.parse(lines)
		if(typeof callback === 'function') callback(input.files[0].name, data)
	}
}
