// デバッグ設定
export const DEBUG_MODE = false; // true なら起動時からデバッグモード。通常は？ボタン長押しで切り替える。

// 赤い月イベント
export const RED_MOON_CHANCE = 0.02; // 通常プレイでゲーム開始時に赤い月になる確率。
export const RED_MOON_DEBUG_CHANCE = 0.6; // デバッグモードでは確認しやすいよう高確率にする。
export const RED_MOON_BASE_COLOR = 0xddddff; // 赤い月モードのベース色。リング・粒子・火花・トレイル・機体ブースト色などはこの色から HSL シフトで派生する。これを変えるとモード全体のトーンが一括で変わる。現状は不気味さを避けるため通常リングと同じ色にしている（赤くしたい場合は 0xff7777 などに戻す）。

// 雪ループ
export const SNOW_LOOP_CHANCE = 0.05; // 通常プレイで次ループが雪になる確率。
export const SNOW_LOOP_DEBUG_CHANCE = 0.6; // デバッグモードでは確認しやすいよう高確率にする。
export const SNOW_SKY_FADE_DURATION = 2.5; // 雪ループ突入/離脱時に空と霧の色を切り替えるのにかける秒数。

// 機体の当たり判定。リング・障害物の両方でこの寸法を共通使用する (機体本体 prism の実寸)。
export const SHIP_HIT_RADIUS_X = 0.45; // 機体の横方向当たり判定半径 (本体幅 ±0.44 相当)。
export const SHIP_HIT_RADIUS_Y = 0.3; // 機体の縦方向当たり判定半径 (本体高 ±0.30 相当)。
export const SHIP_HIT_RADIUS_Z = 1.0; // 機体の奥行き方向当たり判定半径 (本体長 ±1.0 相当)。

// 機体の見た目
export const SHIP_GLOW_WIDTH = 5.6; // 機体を覆う柔らかい光の球の基本サイズ（横）。
export const SHIP_GLOW_HEIGHT = 4.0; // 機体を覆う柔らかい光の球の基本サイズ（縦）。
export const SHIP_GLOW_BOOST_EXPAND = 2.0; // ブースト最大時に光の球を何倍まで膨らませるか（基本サイズに対する追加倍率）。
export const SHIP_GLOW_RAINBOW_EXPAND = 1.0; // レインボー併用時にさらに何倍ぶん膨らませるかの追加倍率。
export const SHIP_SHADOW_OFFSET_Z = 10; // 影が機体より z 方向で何 unit 前方（-z 側）に落ちるか。太陽が後ろから差している想定。

// 燃料円盤（ブースト燃料インジケータ）の見た目
export const FUEL_DISK_Y_OFFSET = 1; // 円盤が機体からどれだけ上に浮くか。
export const FUEL_DISK_MAX_DIAMETER = 15.0; // 円盤の最大外周直径。FUEL値と直径が1:1対応するため、貯められる燃料の秒数上限も兼ねる。
export const FUEL_DISK_COLOR = 0xffd66b; // 内側（現燃料）の色（黄金色 — リングから集めた燃料のイメージ）。
export const FUEL_DISK_TANK_COLOR = 0x6fb8ff; // 外側タンク枠の色。
export const FUEL_DISK_OPACITY = 0.1; // 円盤の不透明度。

// 機体の移動範囲
export const SHIP_MOVE_MIN_Y = -34; // 機体が下方向へ移動できる最低高度。
export const SHIP_MOVE_MAX_Y = 420; // 機体が上方向へ移動できる最高高度。リング出現範囲とは別。
export const SHIP_Y_SPEED = 11.2; // 機体の上下移動速度 (秒あたりの単位距離)。ブースト時は BOOST_SPEED_MULTIPLIER 倍。リング生成側のY可達計算もこの値を参照する。

// 高度による空の見た目
export const SKY_ALTITUDE_FADE_START_Y = 24; // 星空・霧・月の見え方が変わり始める高度。
export const SKY_ALTITUDE_FADE_END_Y = 360; // 星空側の見た目へ完全に寄る高度。
export const SKY_SUNSET_GRADIENT_STOPS = [ // 低空時の夕焼け背景グラデーション。上から下へ並ぶ。
  [0, "#01040f"],
  [0.18, "#071033"],
  [0.38, "#1a2a60"],
  [0.62, "#574875"],
  [0.82, "#9d6159"],
  [1, "#d49b72"],
];
export const SKY_RED_MOON_GRADIENT_STOPS = [ // 赤い月ゲームで使う低空時の暗い紫寄り背景。雪で一時的に隠れる。
  [0, "#01030e"],
  [0.18, "#080c2a"],
  [0.38, "#151848"],
  [0.62, "#2f2462"],
  [0.82, "#56305f"],
  [1, "#8d383d"],
];
export const SKY_SPACE_GRADIENT_STOPS = [ // 最高高度時の暗い宇宙背景グラデーション。夕焼けを残したくない下側ほど黒くする。
  [0, "#000109"],
  [0.18, "#010414"],
  [0.38, "#020716"],
  [0.62, "#02050e"],
  [0.82, "#010308"],
  [1, "#000000"],
];

// 危険高度と大気圏爆発
export const ATMOSPHERE_SPARK_START_Y = 360; // この高度から機体に火花が出始める。デフォルトは360。
export const ATMOSPHERE_EXPLODE_Y = 416; // この高度に達すると大気圏で爆発してゲームオーバーになる。デフォルトは416。
export const ATMOSPHERE_SPARK_RATE_MIN = 256; // 火花が出始めた直後の1秒あたり発生数。
export const ATMOSPHERE_SPARK_RATE_MAX = 3000; // 爆発高度付近の1秒あたり発生数。
export const ATMOSPHERE_SPARK_SIZE = 0.02; // 危険高度で出る火花1粒の大きさ。
export const ATMOSPHERE_SPARK_SPRITE_START_SCALE = 18; // 火花スプライトの出始めサイズ倍率。にじみ込みなので実粒より大きく見せる。
export const ATMOSPHERE_SPARK_SPRITE_END_SCALE = 10; // 火花スプライトが消える直前のサイズ倍率。
export const ATMOSPHERE_SPARK_OFFSET_Y = 0.1; // 火花の発生位置を機体中心から上へずらす量。
export const ATMOSPHERE_SPARK_OFFSET_Z = -0.2; // 火花の発生位置を機体中心からテイル側へずらす量。
export const ATMOSPHERE_SPARK_SPREAD_X = 0; // 火花が機体上部の左右へ散る発生幅。
export const ATMOSPHERE_SPARK_SPREAD_Y = 0.1; // 火花が機体上部の上下へ散る発生幅。
export const ATMOSPHERE_SPARK_SPREAD_Z = 0.5; // 火花が機体上部の前後へ散る発生幅。
export const ATMOSPHERE_SPARK_SPEED_X = 0.5; // 火花が左右へぶれる速度。
export const ATMOSPHERE_SPARK_SPEED_Y = 3; // 火花が上下へぶれる速度。
export const ATMOSPHERE_SPARK_SPEED_Z = 32; // 火花がテイル方向へ直線的に流れる速度。
export const ATMOSPHERE_SPARK_LIFE_BASE = 0.1; // 火花の基本寿命。
export const ATMOSPHERE_SPARK_LIFE_RANDOM = 0.28; // 火花の寿命に足すランダム幅。
export const ATMOSPHERE_SPARK_COLORS = [0xffb36b]; // 危険高度の火花に使う色。
export const ATMOSPHERE_EXPLOSION_PARTICLES = 96; // 大気圏爆発時に出す粒の数。

// 通常リング本体
export const PICKUP_RING_RADIUS = 7.0; // 通常リングの中心半径。
export const PICKUP_RING_TUBE_RADIUS = 0.01; // 通常リングの線の太さ。
export const PICKUP_RING_RADIAL_SEGMENTS = 12; // 通常リング断面の分割数。
export const PICKUP_RING_TUBULAR_SEGMENTS = 128; // 通常リング円周の分割数。
export const PICKUP_RING_BODY_Z_SCALE = 60; // TUBE_RADIUS=0.01 前提で、通常リング本体だけを奥行き方向に0.6相当まで伸ばす倍率。粒子やレインボーリングは伸ばさない。

// レインボーリング本体
export const RAINBOW_RING_RADIUS = PICKUP_RING_RADIUS; // レインボーリング本体の中心半径。
export const RAINBOW_RING_TUBE_RADIUS = 0.08; // レインボーリング本体の線の太さ。
export const RAINBOW_RING_RADIAL_SEGMENTS = 14; // レインボーリング本体断面の分割数。
export const RAINBOW_RING_TUBULAR_SEGMENTS = 24; // レインボーリング1色ぶんの円周分割数。
export const RAINBOW_RING_SEGMENTS = 7; // レインボーリングを何色の弧に分けるか。
export const RAINBOW_RING_ARC_COVERAGE = 0.94; // 各色の弧を円周1区間の何割まで描くか。
export const RAINBOW_RING_SPAWN_INTERVAL = 0.8; // レインボーリング群の中で1個ずつ出る間隔（秒・基準速度時）。距離換算は BASE_SPEED 倍。
export const RAINBOW_RING_CHANCE = 0.07; // 通常時にレインボーリング群を予約する確率。
export const RAINBOW_RING_SNOW_CHANCE = 0.5; // 雪のループ中だけ、雪ボーナスとしてレインボー出現率を上げる。

// 基準速度（リング発生密度はこの速度を基準にした「秒数」を距離単位で扱う）
export const BASE_SPEED = 17; // ループ1の機体速度。スポーン間隔は距離ベースなので速度が上がっても密度は維持される。
export const MAX_SPEED = 128; // 機体速度の上限。ループが進むと徐々にこの値に近づく。

// レインボーリングのグロー
export const RAINBOW_RING_GLOW_RADIUS = RAINBOW_RING_RADIUS - 1.7; // レインボーリンググローの中心半径。
export const RAINBOW_RING_GLOW_TUBE_RADIUS = 0.24; // レインボーリンググローの太さ。
export const RAINBOW_RING_GLOW_RADIAL_SEGMENTS = 12; // レインボーリンググロー断面の分割数。

// リングの出現位置と遠景フェード
export const PICKUP_SPAWN_Z_BASE = -300; // リングが出現する奥行きの基準位置。
export const PICKUP_SPAWN_Z_RANDOM = 10; // リング出現位置をさらに奥へばらつかせる幅。
export const PICKUP_X_RANDOM = 3; // 通常リングが直前のリングから左右へずれる最大幅（±この値）。
export const PICKUP_Y_RANDOM = 5; // 通常リングが直前のリングから上下へずれる最大幅（±この値、極端な低空/高空ジャンプ時を除く）。
export const PICKUP_FADE_NEAR_Z = -120; // この奥行きより手前ではリングが完全不透明。
export const PICKUP_FADE_FAR_Z = -260; // この奥行きより奥ではリングを最低不透明度に近づける。
export const PICKUP_FADE_MIN_OPACITY = 0.08; // 遠景リングが消えずに残る最低不透明度。

// ガイド線とガイド円
export const GUIDE_COLOR = 0xffd66b; // ガイド線と円の通常色。レインボーリング接続時は虹色表示が優先される。
export const GUIDE_PARTICLE_SIZE = 0.1; // ガイド線と円を構成する粒1個の大きさ。

// ガイドのブースト強調
export const GUIDE_BOOST_SCALE_GAIN = 1.2; // 全力ブースト時にガイド円の粒サイズへ加算する倍率。1+この値が最大スケール。
export const GUIDE_BOOST_RADIUS_GAIN = 0.4; // 全力ブースト時にガイド円の直径へ加算する倍率。1+この値が最大スケール。

// リング周囲の光粒
export const SPARKLE_COUNT = 70; // 通常リング周囲の光の粒数。
export const RAINBOW_SPARKLE_COUNT = 120; // レインボーリング周囲の光の粒数。
export const SPARKLE_SIZE = 1.2; // 通常リング周囲の光の粒のサイズ。
export const RAINBOW_SPARKLE_SIZE = 1.5; // レインボーリング周囲の光の粒のサイズ。
export const SPARKLE_RING_RADIUS = 7.2; // リング周囲の光の粒が並ぶ基本半径。
export const SPARKLE_RING_RADIUS_RANDOM = 0.55; // リング周囲の光の粒の半径方向のばらつき。
export const SPARKLE_RING_ANGLE_RANDOM = 0.18; // リング周囲の光の粒の角度ばらつき。
export const SPARKLE_RING_Z_RANDOM = 0.2; // リング周囲の光の粒の奥行きばらつき。
export const SPARKLE_RING_ANGULAR_SPEED = 0.4; // リング周囲の光の粒が回る速度のばらつき。

// リング取得時の火花
export const RING_BURST_PARTICLE_SIZE = 0.1; // リング取得時に出る火花1粒の大きさ。
export const RING_BURST_COUNT = 256; // 通常リング取得時に出る火花の数。
export const RAINBOW_RING_BURST_COUNT = 256; // レインボーリング取得時に出る火花の数。
export const RING_BURST_RADIUS_RANDOM = 0.18; // 火花の発生位置をリング半径からずらす幅。
export const RING_BURST_ANGLE_RANDOM = 0.1; // 火花の発生角度を均等配置からずらす幅。
export const RING_BURST_Z_RANDOM = 0.16; // 火花の発生位置の奥行きばらつき。
export const RING_BURST_INWARD = false; // true にすると火花がリング外周から内側へ向かって散る。
export const RING_BURST_RADIAL_SPEED = 5.2; // 火花がリング外側へ飛ぶ基本速度。
export const RING_BURST_RADIAL_SPEED_RANDOM = 2.2; // 火花が外側へ飛ぶ速度のばらつき。
export const RING_BURST_Z_SPEED_RANDOM = 2.2; // 火花の奥行き方向速度のばらつき。
export const RING_BURST_UPWARD_SPEED = 0.7; // 火花を少し上向きへ散らす速度。
export const RING_BURST_LIFE_BASE = 0.5; // 火花の基本寿命。
export const RING_BURST_LIFE_RANDOM = 0.35; // 火花の寿命のばらつき。

// 海面（島々の下に広がる水）
export const WATER_LEVEL_Y = -39.5; // 海面の高さ。島 (y=-36) より数ユニット下げ、岸壁と合わせて「海に立つ島」に見せる。
export const WATER_DEEP_COLOR = 0x0a1626; // 通常時の深い水の色。
export const WATER_SHALLOW_COLOR = 0x16344a; // 通常時の浅い/明るい水の色。深い色とノイズで混ざる。
export const WATER_DEEP_COLOR_SNOW = 0x8fa8b8; // 雪ループ時の深い水の色（凍った海のイメージ）。
export const WATER_SHALLOW_COLOR_SNOW = 0xb6c8d4; // 雪ループ時の浅い水の色。
export const WATER_DEEP_COLOR_RED_MOON = 0x160a14; // 赤い月時の深い水の色。
export const WATER_SHALLOW_COLOR_RED_MOON = 0x2c1430; // 赤い月時の浅い水の色。
export const WATER_WAVE_AMP = 1.0; // 波の強さ。大きいほど水面が荒れる。
export const WATER_WAVE_AMP_SNOW = 0.25; // 雪ループ時の波の強さ（凍ってほぼ静まる）。

// 地面と島のループ/遠景フェード
export const GROUND_WRAP_END_Z = 120; // この奥行きまで来たら島を奥へ戻して次のループに入る。
export const GROUND_WRAP_DISTANCE = 520; // 地面/島がループする距離。大きいほど遠くから島が現れ、現れる頻度は下がる。
export const GROUND_LOOP_START_Z = GROUND_WRAP_END_Z - GROUND_WRAP_DISTANCE; // 地面/島ループの開始Z。折り返し位置からループ距離ぶん奥へ戻した位置。
export const GROUND_FADE_NEAR_Z = -150; // この奥行きより手前では島が完全不透明。
export const GROUND_FADE_FAR_Z = -380; // この奥行きより奥では島を最低不透明度に近づける。
export const GROUND_FADE_MIN_OPACITY = 0.05; // 遠景の島が完全に消えずに残る最低不透明度。
export const ISLAND_EDGE_FADE_START = 0.9; // 島の円盤フェード開始半径(0=中心, 1=外周)。これより内側は完全不透明。
export const ISLAND_EDGE_FADE_END = 1.0; // 島の円盤が完全透明になる半径。

// 雲のループ/遠景フェード
export const CLOUD_WRAP_DISTANCE = 320; // 雲がループする距離。z>18で折り返した時にこの値だけ引かれて再出現する(=z約-302)。
export const CLOUD_FADE_NEAR_Z = -80; // この奥行きより手前では雲が完全不透明(基準不透明度100%)。
export const CLOUD_FADE_FAR_Z = -260; // この奥行きより奥では雲が最低不透明度まで薄くなる。
export const CLOUD_FADE_MIN_OPACITY = 0; // 遠景での雲の最低不透明度。0で完全に消える。

// リング報酬とブースト性能
export const BOOST_FUEL_PER_RING = 0.5; // 通常リング1個で増えるブースト燃料の秒数。
export const RAINBOW_RING_MULTIPLIER = 5; // レインボーリング報酬の通常リング比。
export const BOOST_SPEED_MULTIPLIER = 3; // ブースト中の上下左右移動速度倍率。
export const NORMAL_RING_SCORE = 10; // 通常リング1個で増えるスコア。
export const RAINBOW_RING_SCORE = 70; // レインボーリング1個で増えるスコア。
export const BOOST_SCORE_MULTIPLIER = 10; // ブースト中にリング取得スコアへ掛ける倍率。
export const SCORE_MAX_DIGITS = 7; // スコアの最大桁数（HUDのゼロ詰めと上限クランプの両方の基準）。
export const SCORE_MAX = 10 ** SCORE_MAX_DIGITS - 1; // スコアの上限値（9999999）。これ以上は加算してもクランプされる。

// 噴射粒の生成数
export const TRAIL_SPAWN_RATE = 30; // 光の粒を1秒あたり何個ペースで生成するか。
export const BOOST_TRAIL_MULTIPLIER = 1; // ブースト中の噴射粒の発生倍率。
export const TRAIL_MAX = 500; // 同時に残せる光の粒の最大数。

// 噴射粒のレインボー色
export const TRAIL_RAINBOW_TINT_MAX = 1.0; // レインボー中に噴射粒へ混ぜる虹色の最大量。
export const TRAIL_RAINBOW_HUE_RANDOM = 0.3; // 噴射粒の虹色をランダムにずらす幅。
export const TRAIL_RAINBOW_SATURATION = 1.5; // 噴射粒に混ぜる虹色の彩度。
export const TRAIL_RAINBOW_LIGHTNESS = 0.64; // 噴射粒に混ぜる虹色の明るさ。

// 噴射粒の発生位置と広がり
export const TRAIL_BOOST_SPREAD = 1.8; // ブースト中に噴射粒の発生位置を広げる倍率。
export const TRAIL_OFFSET_X = 0.32; // 噴射粒の左右方向の発生幅。
export const TRAIL_OFFSET_Y_BASE = -1.0; // 噴射粒の発生位置を機体中心から下へずらす量。
export const TRAIL_OFFSET_Y = 0.5; // 噴射粒の上下方向の発生幅。
export const TRAIL_OFFSET_Z_BASE = 1.45; // 噴射粒の発生位置を機体後方へずらす量。
export const TRAIL_OFFSET_Z_RANDOM = 0.6; // 噴射粒の後方発生位置のランダム幅。
export const TRAIL_OFFSET_Z_BOOST = 0.9; // ブースト中に後方発生位置をさらに広げる量。

// 噴射粒の移動
export const TRAIL_ANGLE_SPREAD = 0.95; // 噴射粒が左右へ散る角度幅。
export const TRAIL_ANGLE_BOOST_SPREAD = 1.35; // ブースト中に左右の散り方を広げる倍率。
export const TRAIL_ANGLE_Y_SPREAD = 0.55; // 噴射粒が上下へ散る角度幅。
export const TRAIL_ANGLE_Y_BOOST_SPREAD = 1.65; // ブースト中に上下の散り方を広げる倍率。
export const TRAIL_SPEED_BASE = 2.7; // 噴射粒の基本速度。
export const TRAIL_SPEED_RANDOM = 2.4; // 噴射粒の速度に足すランダム幅。
export const TRAIL_SPEED_BOOST = 0.9; // ブースト中に噴射粒速度へ足す量。
export const TRAIL_BACKWARD_SPEED_MULTIPLIER = 3; // 噴射粒が後ろへ流れる速度倍率。
export const TRAIL_INPUT_DRIFT = 0.18; // 機体操作と逆方向へ噴射粒を少し流す量。
export const TRAIL_VERTICAL_SPEED_SCALE = 0.5; // 上下方向の噴射速度を抑える倍率。
export const TRAIL_VERTICAL_DRIFT = -0.16; // 噴射粒を少し下向きへ流す量。
export const TRAIL_VERTICAL_BOOST_LIFT = 0.1; // ブースト中に噴射粒を少し上向きへ戻す量。

// 噴射粒の見た目
export const TRAIL_OPACITY_NORMAL = 0.85; // 通常時の噴射粒の不透明度。
export const TRAIL_OPACITY_BOOST = 0.68; // ブースト中の噴射粒の不透明度。
export const TRAIL_LIFE_BASE = 1.6; // 噴射粒の基本寿命。
export const TRAIL_LIFE_RANDOM = 1.2; // 噴射粒の寿命に足すランダム幅。
export const TRAIL_LIFE_BOOST = 0.55; // ブースト中に噴射粒の寿命へ足す量。
export const TRAIL_START_SCALE_BASE = 0.28; // 噴射粒の出始めの基本サイズ。
export const TRAIL_START_SCALE_RANDOM = 0.18; // 噴射粒の出始めサイズに足すランダム幅。
export const TRAIL_START_SCALE_BOOST = 0.05; // ブースト中に出始めサイズへ足す量。
export const TRAIL_END_SCALE_GROWTH = 1.4; // 噴射粒が消えるまでに広がる基本量。
export const TRAIL_END_SCALE_RANDOM = 1.2; // 噴射粒の広がりに足すランダム幅。
export const TRAIL_END_SCALE_BOOST = 1.2; // ブースト中に噴射粒の広がりへ足す量。
