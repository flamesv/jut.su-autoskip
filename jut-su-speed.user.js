// ==UserScript==
// @name         JUT SU SPEED
// @namespace    http://tampermonkey.net/
// @version      1.0.1
// @description  try to take over the world!
// @author       flamesv and DrakonSeryoga
// @updateURL    https://github.com/flamesv/jut.su-autoskip/raw/fixed-transition-to-the-next-season/jut-su-speed.user.js
// @downloadURL  https://github.com/flamesv/jut.su-autoskip/raw/fixed-transition-to-the-next-season/jut-su-speed.user.js
// @match        *://jut.su/*
// @icon         https://www.google.com/s2/favicons?domain=jut.su
// @run-at       document-body
// @grant        GM_xmlhttpRequest
// ==/UserScript==


window.onload = () => {
    'use strict';

    let playbackRate = 3;
    const regexBase64 = new RegExp('pview_id = "[0-9]{1,}"; eval\\( Base64.decode\\( (.+)" \\)', 'u')
    
    async function fetchVideoSrc(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Ошибка HTTP: ${response.status}`);
            }
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const videoElement = doc.querySelector('video#my-player');
            if (!videoElement) {
                throw new Error('Элемент <video> с id="my-player" не найден');
            }
            const sourceElement = videoElement.querySelector('source');
            if (!sourceElement) {
                throw new Error('Элемент <source> не найден внутри <video>');
            }
            let base64Data = html.match(regexBase64);
            return {src: sourceElement.src, base64Data: base64Data[1]};
        } catch (error) {
            console.error('Произошла ошибка:', error);
            return null;
        }
    }

    function getInitialSeasonAndEpisode() {
        let re;
        if (location.href.indexOf('season') !== -1) {
            re = /season-(\d+).*episode-(\d+)/;
        } else {
            re = /episode-(\d+)/;
        }
        const match = location.href.match(re);
        if (match) {
            if (location.href.indexOf('season') !== -1) {
                return [parseInt(match[1]), parseInt(match[2])];
            } else {
                return [1, parseInt(match[1])];
            }
        } else {
            return [0, 0];
        }
    }

    function getNextEpisodeInfo(initSeasonAndEpisode, recursion_level = 0) {
        if (recursion_level > 1) return false;
        let test = fetchVideoSrc(`/${location.href.split('/').slice(3,4)[0]}/season-${initSeasonAndEpisode[0]}/episode-${initSeasonAndEpisode[1]}.html`).then((nextEposodeInfo_) => {
            return nextEposodeInfo_ ? nextEposodeInfo_ : false;
        });
        return test.then((res) => {
            if (!res) {
                initSeasonAndEpisode = [initSeasonAndEpisode[0]+1, 1]
                return getNextEpisodeInfo(initSeasonAndEpisode, recursion_level+1);
            }
            return res;
        })
    }

    var initSeasonAndEpisode = getInitialSeasonAndEpisode();

    function injectBlock(text) {
        let getEpisodeBlock = document.getElementById('episodeBlock');
        if (!getEpisodeBlock) document.getElementById('my-player').insertAdjacentHTML('afterbegin', `<div class="vjs-overlay vjs-overlay-top-right vjs-overlay-background" id="episodeBlock">${text}</div>`)
        return document.getElementById('episodeBlock');
    }

    let currentEpisodeBlock;

    let tryShowEpisode = setInterval(() => {
        currentEpisodeBlock = injectBlock(initSeasonAndEpisode[0] + ' - ' + initSeasonAndEpisode[1]);
        currentEpisodeBlock.style.zIndex = 1;
        currentEpisodeBlock.style.padding = "5px 10px";
        currentEpisodeBlock.style.userSelect = "none";
        currentEpisodeBlock.style.opacity = "0.7";
        clearInterval(tryShowEpisode)
    }, 1000);

    var started = 0;
    let nextEpisode;
    var startInterval = setInterval(() => {
        const skipIntroButton = Array.from(document.querySelectorAll('div.vjs-overlay')).find(el => el.innerText.includes('Пропустить заставку'));
        if (skipIntroButton) {skipIntroButton.remove()}
        const nextEpisodeButton = Array.from(document.querySelectorAll('div.vjs-overlay')).find(el => el.innerText.includes('Следующая серия'));
        if (nextEpisodeButton) {nextEpisodeButton.remove()}
        const listenOnAM = document.querySelector('div.vjs-overlay-listen-on-am');
        if (listenOnAM) { listenOnAM.remove(); }

        if (document.getElementById('my-player_html5_api').readyState === 0 && started === 0) {
            started = 1;
            player.playbackRate(playbackRate);
            player.play();
        }
        try {
            if (player.currentTime() >= video_intro_start && player.currentTime() <= video_intro_end - 0.5) {
                player.currentTime(video_intro_end);
            };
        } catch {}
        try {
            if (player.currentTime() >= player.duration() - 0.5 || player.currentTime() >= video_outro_start) {
                player.currentTime(0);
                player.pause()

                initSeasonAndEpisode = [initSeasonAndEpisode[0], initSeasonAndEpisode[1]+1]
                nextEpisode = getNextEpisodeInfo(initSeasonAndEpisode);
                if (nextEpisode) {
                    nextEpisode.then((nextEpisodeInfo) => {
                        player.src({
                            src: nextEpisodeInfo['src']
                        });
                        let episodeData = Base64.decode(nextEpisodeInfo['base64Data'])
                        eval(episodeData)
                        initSeasonAndEpisode = [Number(pview_season), Number(pview_episode)]
                        currentEpisodeBlock.textContent = initSeasonAndEpisode[0] + ' - ' + initSeasonAndEpisode[1]
                        player.load();
                        started = 0;
                    })
                }
            };
        } catch {}
    }, 1000);
}
