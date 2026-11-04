/**
 * 站点 BGM 歌单 —— 来自 BaKaMiku 的网易云歌单《bakamiku55》
 * https://music.163.com/m/playlist?id=18538640068
 *
 * 换歌：改 id 即可（https://music.163.com/song?id=<id>）。
 * pic 用网易云的 `?param=120y120` 取小图，别用原图——原图单张 70KB，12 首就是 840KB。
 *
 * 换完先验能不能播：
 *   curl -s -o /dev/null -D - -r 0-0 \
 *     'https://你的域名/meting/api?server=netease&type=url&id=<新ID>' | grep -i 'content-type\|content-range'
 * 要看到 audio/mpeg，且 content-range 的总字节不是 481115
 * （481115 是「30 秒试听」的固定长度，说明这首是 VIP/受限曲，放不了）。
 *
 * 当前 12 首已逐首验过，全部是完整曲目。
 */
export interface Track {
  id: string;
  title: string;
  artist: string;
  pic: string;
}

export const playlist: Track[] = [
  { id: '29107447', title: 'ろりこんでよかった～', artist: 'ちぃむdmp☆', pic: 'https://p1.music.126.net/rB8Jb2K8sb3ycLJMQcT9Yg==/2534374302073281.jpg?param=120y120' },
  { id: '579954', title: '恋愛サーキュレーション', artist: '花澤香菜', pic: 'https://p1.music.126.net/wImDxYDsJcWDIH9znDhEPA==/109951165561008752.jpg?param=120y120' },
  { id: '809268', title: 'sweets parade', artist: '花澤香菜', pic: 'https://p1.music.126.net/soVzasgTYU36F1uAirKEhQ==/109951165628137310.jpg?param=120y120' },
  { id: '537854737', title: 'アイロニ', artist: '鹿乃', pic: 'https://p1.music.126.net/iLcmytETSkZgd8xcGVEO5A==/109951163200361748.jpg?param=120y120' },
  { id: '27605798', title: 'eternal reality', artist: 'fripSide', pic: 'https://p1.music.126.net/aNFUaVDbqwhxeydZyCoDqg==/109951166141420470.jpg?param=120y120' },
  { id: '478303470', title: '心做し', artist: '双笙（陈元汐）', pic: 'https://p1.music.126.net/4m79yXLdqFt_0mbx9DjsoA==/109951166279817646.jpg?param=120y120' },
  { id: '1453967494', title: '君のせい', artist: 'the peggies', pic: 'https://p1.music.126.net/wG7XoNdJAih1osc4NHHCAg==/109951165048575775.jpg?param=120y120' },
  { id: '32431066', title: '神のまにまに', artist: '初音ミク / 鏡音リン / GUMI / れるりり', pic: 'https://p1.music.126.net/ze4CaBh_BTQrtBzbhYTI3A==/7886796906969685.jpg?param=120y120' },
  { id: '547323046', title: '花降らし（翻自 n-buna）', artist: 'NatsuKome夏米', pic: 'https://p1.music.126.net/kd-gZ7rzaUlq2SKTF4kKyg==/109951167861565542.jpg?param=120y120' },
  { id: '469073360', title: '深海少女', artist: 'ゆうゆ / 初音ミク', pic: 'https://p1.music.126.net/vUctQgqXFx9d3oA3ofKriA==/18668607929793307.jpg?param=120y120' },
  { id: '522749811', title: '未闻花名 - 【钢琴】secret base ~君がくれたもの', artist: 'Oturans', pic: 'https://p1.music.126.net/6fw0sKYnqkWjisM7w7_4DQ==/109951163078058569.jpg?param=120y120' },
  { id: '2672185401', title: '空之箱【河原木桃香】（YingZ.白应钟 remix）', artist: '鳶尾花p_0317', pic: 'https://p1.music.126.net/6WoSZ8hO66krKnzZBfgLTw==/109951172012740888.jpg?param=120y120' }
];
