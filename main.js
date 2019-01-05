// ==UserScript==
// @name        Mark Watched YouTube Videos
// @namespace   MarkWatchedYouTubeVideos
// @description Add an indicator for watched videos on YouTube
// @version     1.0.12
// @license     AGPL v3
// @author      jcunews
// @include     https://www.youtube.com/*
// @grant       GM_getValue
// @grant       GM_setValue
// @run-at      document-start
// ==/UserScript==

(function() {
  
  //=== config start ===
  var maxWatchedVideoAge   = 180;    //number of days. set to zero to disable (not recommended)
  var pageLoadMarkDelay    = 400;    //number of milliseconds to wait before marking video items on page load phase (increase if slow network/browser)
  var contentLoadMarkDelay = 600;    //number of milliseconds to wait before marking video items on content load phase (increase if slow network/browser)
  var markerMouseButtons   = [0, 1]; //one or more mouse buttons to use for manual marker toggle. 0=left, 1=right, 2=middle. e.g.:
                                     //if `[0]`, only left button is used, which is ALT+LeftClick.
                                     //if `[1]`, only right button is used, which is ALT+RightClick.
                                     //if `[0,1]`, any left or right button can be used, which is: ALT+LeftClick or ALT+RightClick.
  //=== config end ===

  var watchedVideos, ageMultiplier = 24 * 60 * 60 * 1000;

  function getVideoId(url) {
    var vid = url.match(/\/watch(?:\?|.*?&)v=([^&]+)/);
    if (vid) vid = vid[1] || vid[2];
    return vid;
  }

  function watched(vid, res) {
    res = -1;
    watchedVideos.some(function(v, i) {
      if (v.id === vid) {
        res = i;
        return true;
      } else return false;
    });
    return res;
  }

  function processVideoItems(selector) {
    var items = document.querySelectorAll(selector), i, link;
    for (i = items.length-1; i >= 0; i--) {
      link = items[i].querySelector("A");
      if (link) {
        if (watched(getVideoId(link.href)) >= 0) {
          items[i].classList.add("watched");
        } else items[i].classList.remove("watched");
      }
    }
  }

  function processAllVideoItems() {
    //home page
    processVideoItems(".yt-uix-shelfslider-list>.yt-shelf-grid-item");
    //subscriptions page
    processVideoItems(".multirow-shelf>.shelf-content>.yt-shelf-grid-item");
    //channel/user home page
    processVideoItems("#contents>.ytd-item-section-renderer>.ytd-newspaper-renderer"); //old
    processVideoItems("#items>.yt-horizontal-list-renderer"); //old
    processVideoItems("#contents>.ytd-channel-featured-content-renderer"); //new
    processVideoItems("#contents>.ytd-shelf-renderer>#grid-container>.ytd-expanded-shelf-contents-renderer"); //new
    //channel/user video page
    processVideoItems(".yt-uix-slider-list>.featured-content-item");
    processVideoItems("#items>.ytd-grid-renderer");
    //channel/user playlist page
    processVideoItems(".expanded-shelf>.expanded-shelf-content-list>.expanded-shelf-content-item-wrapper");
    //channel/user playlist item page
    processVideoItems(".pl-video-list .pl-video-table .pl-video");
    //channel/user videos page
    processVideoItems(".channels-browse-content-grid>.channels-content-item");
    //channel/user search page
    if (/^\/(?:channel|user)\/.*?\/search/.test(location.pathname)) {
      processVideoItems(".ytd-browse #contents>.ytd-item-section-renderer"); //new
    }
    //search page
    processVideoItems("#results>.section-list .item-section>li"); //old
    processVideoItems("#browse-items-primary>.browse-list-item-container"); //old
    processVideoItems(".ytd-search #contents>.ytd-item-section-renderer"); //new
    //video page sidebar
    processVideoItems(".watch-sidebar-body>.video-list>.video-list-item"); //old
    processVideoItems(".playlist-videos-container>.playlist-videos-list>li"); //old
    processVideoItems("#items>.ytd-watch-next-secondary-results-renderer .ytd-compact-video-renderer"); //new
  }

  function doProcessPage() {
    //get list of watched videos
    watchedVideos = GM_getValue("watchedVideos");
    if (!watchedVideos) {
      watchedVideos = "[]";
      GM_setValue("watchedVideos", watchedVideos);
    }
    try {
      watchedVideos = JSON.parse(watchedVideos);
      if (watchedVideos.length && (("object" !== typeof watchedVideos[0]) || !watchedVideos[0].id)) {
        watchedVideos = "[]";
        GM_setValue("watchedVideos", watchedVideos);
      }
    } catch(z) {
      watchedVideos = "[]";
      GM_setValue("watchedVideos", watchedVideos);
    }

    //remove old watched video history
    var i = 0, now = (new Date()).valueOf();
    if (maxWatchedVideoAge > 0) {
      while (i < watchedVideos.length) {
        if (((now - watchedVideos.timestamp) / ageMultiplier) > maxWatchedVideoAge) {
          watchedVideos.splice(0, 1);
        } else break;
      }
    }

    //check and remember current video
    var vid = getVideoId(location.href);
    if (vid && (watched(vid) < 0)) {
      watchedVideos.push({id: vid, timestamp: now});
      GM_setValue("watchedVideos", JSON.stringify(watchedVideos));
    }

    //=== mark watched videos ===
    processAllVideoItems();
  }

  function processPage() {
    setTimeout(doProcessPage, 200);
  }

  var xhropen = XMLHttpRequest.prototype.open, xhrsend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url) {
    this.url_mwyv = url;
    return xhropen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function(method, url) {
    if (!this.listened_mwyv) {
      this.listened_mwyv = 1;
      this.addEventListener("load", function() {
        if ((/\/\w+_ajax\?/).test(this.url_mwyv)) processPage();
      });
    }
    return xhrsend.apply(this, arguments);
  };

  addEventListener("DOMContentLoaded", function() {
    var style = document.createElement("STYLE");
    style.innerHTML = `
/* subscription page, channel/user home page feeds */
.watched .yt-lockup-content, .watched .yt-lockup-content *,
/* channel/user home page videos, channel/user videos page */
.watched .channels-content-item,
/* video page */
.watched,
.watched .content-wrapper,
.watched>a
    { background-color: #cec }
.playlist-videos-container>.playlist-videos-list>li.watched,
.playlist-videos-container>.playlist-videos-list>li.watched>a,
.playlist-videos-container>.playlist-videos-list>li.watched .yt-ui-ellipsis
    { background-color: #030 !important }
`;
    document.head.appendChild(style);
  });

  var lastFocusState = document.hasFocus();
  addEventListener("blur", function() {
    lastFocusState = false;
  });
  addEventListener("focus", function() {
    if (!lastFocusState) processPage();
    lastFocusState = true;
  });
  addEventListener("click", function(ev, vid, i) {
    if ((markerMouseButtons.indexOf(ev.button) >= 0) && ev.altKey) {
      i = ev.target;
      if (i) {
        if (i.href) {
          vid = getVideoId(i.href);
        } else {
          i = i.parentNode;
          while (i) {
            if (i.tagName === "A") {
              vid = getVideoId(i.href);
              break;
            }
            i = i.parentNode;
          }
        }
        if (vid) {
          i = watched(vid);
          if (i >= 0) {
            watchedVideos.splice(i, 1);
          } else watchedVideos.push({id: vid, timestamp: (new Date()).valueOf()});
          GM_setValue("watchedVideos", JSON.stringify(watchedVideos));
          processAllVideoItems();
        }
      }
    }
  });
  if (markerMouseButtons.indexOf(1) >= 0) {
    addEventListener("contextmenu", function(ev, vid, i) {
      if (ev.altKey) {
        i = ev.target;
        if (i) {
          if (i.href) {
            vid = getVideoId(i.href);
          } else {
            i = i.parentNode;
            while (i) {
              if (i.tagName === "A") {
                vid = getVideoId(i.href);
                break;
              }
              i = i.parentNode;
            }
          }
          if (vid) {
            i = watched(vid);
            if (i >= 0) {
              watchedVideos.splice(i, 1);
            } else watchedVideos.push({id: vid, timestamp: (new Date()).valueOf()});
            GM_setValue("watchedVideos", JSON.stringify(watchedVideos));
            processAllVideoItems();
          }
        }
      }
    });
  }
  if (window["body-container"]) { //old
    addEventListener("spfdone", processPage);
    processPage();
  } else { //new
    var t=0;
    function pl() {
      clearTimeout(t);
      t = setTimeout(processPage, 300);
    }
    (function init(vm) {
      if (vm = document.getElementById("visibility-monitor")) {
        vm.addEventListener("viewport-load", pl);
      } else setTimeout(init, 100);
    })();
    (function init2(mh) {
      if (mh = document.getElementById("masthead")) {
        mh.addEventListener("yt-rendererstamper-finished", pl);
      } else setTimeout(init2, 100);
    })();
    addEventListener("load", function() {
      setTimeout(processPage, pageLoadMarkDelay);
    });
    addEventListener("spfprocess", function() {
      setTimeout(processPage, contentLoadMarkDelay);
    });
  }
})();
