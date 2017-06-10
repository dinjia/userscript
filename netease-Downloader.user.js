// ==UserScript==
// @name       Netease-Downloader
// @description  a script about netease music downloader
// @version   201706010
// @author     dinjia
// @include     http*://music.163.com/*
// @grant       unsafeWindow
// @grant        GM_xmlhttpRequest
// @connect       126.net
// @namespace 
// ==/UserScript==
var api = {
    getTrackURL: function(dfsId) {
        var byte1 = '3go8&$8*3*3h0k(2)2';
        var byte2 = dfsId + '';
        var byte3 = [];
        for (var i = 0; i < byte2.length; i++) {
            byte3[i] = byte2.charCodeAt(i) ^ byte1.charCodeAt(i % byte1.length);
        }
        byte3 = byte3.map(function(i) {
            return String.fromCharCode(i);
        }).join('');
        var results = unsafeWindow.CryptoJS.MD5(byte3).toString(unsafeWindow.CryptoJS.enc.Base64).replace(/\//g, '_').replace(/\+/g, '-');
        var url = 'http://p2.music.126.net/' + results + '/' + byte2;
        return url;
    },
    encrypt_request: function(callback, url, data) {
        data.csrf_token = '';
        var pubKey = '010001';
        var modulus = '00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7';
        var nonce = '0CoJUm6Qyw8W8jud';
        var result = unsafeWindow.asrsea(JSON.stringify(data), pubKey, modulus, nonce);
        GM_xmlhttpRequest({
            method: 'POST',
            url: url,
            data: 'params=' + encodeURIComponent(result.encText) + '&encSecKey=' + encodeURIComponent(result.encSecKey),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            //  onload: function (response) {
            //   callback(JSON.parse(this.responseText));
            // }
            onreadystatechange: function(res) {
                if (res.readyState == 4 && res.status == 200) {
                    callback(JSON.parse(res.responseText));
                }
            }
        });
    },
    detail: function(songId, callback) {
        var url = '/weapi/v3/song/detail?csrf_token=';
        var data = {
            c: JSON.stringify([{
                id: songId
            }])
        };
        this.encrypt_request(callback, url, data);
    },
    lrc: function(songId, callback) {
        var url = '/weapi/song/lyric?csrf_token=';
        var data = {
            id: songId,
            lv: -1,
            tv: -1
        };
        this.encrypt_request(callback, url, data);
    },
    newsong: function(songId, callback) {
        var url = '/weapi/song/enhance/player/url?csrf_token=';
        var data = {
            ids: [songId],
            br: 999000,
        };
        this.encrypt_request(callback, url, data);
    },
    mv: function(mvId, callback) {
        var url = '/weapi/mv/detail/';
        var data = {
            id: mvId,
        };
        this.encrypt_request(callback, url, data);
    },
    search: function(songid, callback) {
        var url = '/weapi/search/pc';
        var data = {
            s: songid,
            limit: 1,
            type: 1,
            offset: 0,
        };
        this.encrypt_request(callback, url, data);
    }
};
var innerFrame = document.querySelector('iframe');
var pages = [{
    url: 'music.163.com/#/song?id=',
    handler: function() {
        var songId = location.href.match(/id=([0-9]+)/)[1];
        var downloadLine = this.createDownloadLine(songId);
        var innerFrameDoc = innerFrame.contentWindow.document;
        var albumNode = innerFrameDoc.querySelectorAll('p.des.s-fc4')[1];
        var parentNode = albumNode.parentNode;
        parentNode.insertBefore(downloadLine, albumNode.nextElementSibling);
    },
    createDownloadLine: function(songId) {
        var dl = new Downloader();
        var name = document.title.replace(/- 网易云音乐/, '');
        var disableStyle = function(link) {
            link.text += '(无)';
            link.style.color = 'gray';
            link.style.textDecoration = 'none';
            link.style.cursor = 'auto';
        };
        var setUrlAndSize = function(mp3Link, Music) {
            if (Music) {
                var href = Music.url;
                if (href) {
                    mp3Link.href = href;
                    mp3Link.text += (Music.size / 1024 / 1024).toFixed(1) + 'M';
                    mp3Link.download = name + '.mp3';
                    dl.BindAnthor(mp3Link);
                    return;
                } else {
                    api.search(songId,
                    function(result) {
                        var song = result.result.songs[0];
                        var music = song.hMusic || song.hMusic || song.lMusic || song.bMusic;
                        var mp3url;
                        if (music && music.dfsId != 0) {
                            mp3url = api.getTrackURL(music.dfsId) + '.mp3';
                        } else {
                            mp3url = song.mp3Url;
                        }
                        if (mp3url) {
                            mp3Link.href = mp3url;
                            mp3Link.text += (music.size / 1024 / 1024).toFixed(1) + 'M';
                            mp3Link.download = name + '.mp3';
                            dl.BindAnthor(mp3Link);
                        } else {
                            disableStyle(mp3Link);
                        }
                    });
                }
            }
        };
        var setLyric = function(LycLink, result) {
            var LrC = '';
            var lrc = result.lrc;
            var tlrc = result.tlyric;
            var num = 0;
            if (lrc && lrc.lyric) {
                LrC += lrc.lyric + '\n';
                num += 1;
            }
            if (tlrc && tlrc.lyric) {
                LrC += tlrc.lyric;
                num += 2;
            }
            if (num !== 0) {
                var html = '';
                switch (num) {
                case 1:
                    html = '(原)';
                    break;
                case 2:
                    html = '(译)';
                    break;
                case 3:
                    html = '(合)';
                    break;
                }
                LycLink.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(LrC);
                LycLink.innerHTML += html;
                LycLink.download = name + '.lrc';
            } else {
                disableStyle(LycLink);
            }
        };
        var setMV = function(mvLink, song) {
            if (song.mv) {
                api.mv(song.mv,
                function(result) {
                    var mv = result.data.brs;
                    mvLink.href = mv[720] || mv[480] || mv[240];
                    mvLink.download = name + '.mp4';
                    dl.BindAnthor(mvLink);
                });
            } else {
                disableStyle(mvLink);
            }
        };
        var setPic = function(picLink, song) {
            if (song.al.pic_str || song.al.pic) {
                var img = innerFrame.contentWindow.document.querySelector('.j-img');
                picLink.href = img.dataset.src = api.getTrackURL(song.al.pic_str || song.al.pic);
                img.src = img.dataset.src + '?param=130y130';
                picLink.download = name + '.jpg';
                dl.BindAnthor(picLink);
            } else {
                disableStyle(picLink);
            }
        };
        var newMp3Link = this.createLink('歌曲');
        var lyricLink = this.createLink('歌词');
        var mvLink = this.createLink('mv');
        var picLink = this.createLink('封面');
        api.detail(songId,
        function(result) {
            var song = result.songs[0];
            setMV(mvLink, song);
            setPic(picLink, song);
        });
        api.newsong(songId,
        function(result) {
            var song = result.data[0];
            setUrlAndSize(newMp3Link, song);
        });
        api.lrc(songId,
        function(result) {
            setLyric(lyricLink, result);
        });
        var container = this.createLineContainer('下载');
        container.appendChild(newMp3Link);
        container.appendChild(lyricLink);
        container.appendChild(mvLink);
        container.appendChild(picLink);
        return container;
    },
    createLink: function(label) {
        var link = document.createElement('a');
        link.innerHTML = label;
        link.className = 's-fc7';
        link.style.marginRight = '10px';
        link.href = 'javascript:void(0);';
        link.target = '_blank';
        return link;
    },
    createLineContainer: function(label) {
        var container = document.createElement('p');
        container.className = 'desc s-fc4';
        container.innerHTML = label + '：';
        container.style.margin = '10px 0';
        return container;
    },
},
];
if (innerFrame) {
    innerFrame.addEventListener('load',
    function() {
        var i, page;
        for (i = 0; i < pages.length; i += 1) {
            page = pages[i];
            if (location.href.indexOf(page.url) != -1) {
                page.handler();
            }
        }
    });
}
document.cookie = 'os=linux';
function Downloader() {
    // request
    function FileRequest(url, progress, callback) {
        var req = GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            onprogress: function(res) {
                if (progress) progress(res);
            },
            responseType: 'blob',
            onreadystatechange: function(res) {
                if (res.readyState == 4) {
                    if (res.status == 200) {
                        var blob = res.response;
                        callback(blob, res.status);
                    } else {
                        callback(null, res.status);
                    }
                }
            }
        });
    } //save file
    function SaveFile(blob, filename) {
        if (navigator.msSaveBlob) {
            navigator.msSaveBlob(blob, filename);
        } else {
            var anchor = document.createElement('a');
            var url = URL.createObjectURL(blob);
            anchor.download = filename;
            anchor.href = url;
            var event = new MouseEvent('click');
            anchor.addEventListener('click',
            function(e) {
                console.log(filename + '下载成功');
            },
            false);
            anchor.dispatchEvent(event);
            URL.revokeObjectURL(url);
        }
    } //interface
    function FileDownload(url, filename, downloading, success, error) {
        FileRequest(url, downloading,
        function(blob, status) {
            if (status == 200) {
                SaveFile(blob, filename);
                if (typeof success == 'function') success();
            } else {
                if (typeof error == 'function') error(status);
            }
        });
    }
    this.FileDownload = FileDownload;
    var anthorEvents = {
        onprogress: function(res) {
            if (res.lengthComputable) {
                this.anchor.innerHTML = '下载:' + (res.loaded * 100 / res.total).toFixed(2) + '%';
            } else {
                this.anchor.innerHTML = '下载:' + anthorEvents.calcLength(res.loaded);
            }
        },
        calcLength: function(b) {
            b = Number(b) / 1024;
            if (b < 1024) {
                return b.toFixed(1) + 'KB';
            }
            b = b / 1024;
            if (b < 1024) {
                return b.toFixed(2) + 'MB';
            }
            b = b / 1024;
            return b.toFixed(3) + 'GB';
        },
        onsuccess: function() {
            this.anchor.innerHTML = this.Html;
            this.doing = false;
        },
        onerror: function() {
            this.anchor.innerHTML = '下载失败';
            this.handler = setTimeout(function(t) {
                t.anchor.innerHTML = t.Html;
                t.doing = false;
            },
            2000, this);
        },
        onAnthorClick: function(e) {
            e = e || event;
            var a = this.anchor;
            var ex = /([\w\s]+)(\.\w)(\?.*)?$/i.exec(a.href || '');
            var name = a.download || a.title;
            if (ex) {
                if (!name && ex.length > 1) name = ex[1];
                if (name && name.indexOf('.') == -1 && ex.length > 2) name += ex[2];
            }
            if (!name || !a.href) return;
            e.preventDefault();
            if (this.doing) return;
            this.doing = true;
            FileDownload(a.href, name, anthorEvents.onprogress.bind(this), anthorEvents.onsuccess.bind(this), anthorEvents.onerror.bind(this));
        }
    };
    //interface
    function BindAnthor(a) {
        var env = {
            Html: a.innerHTML,
            anchor: a
        };
        a.addEventListener('click', anthorEvents.onAnthorClick.bind(env), true);
    }
    this.BindAnthor = BindAnthor;
}
