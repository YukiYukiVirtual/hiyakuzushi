(function(){
	var FIELD;
	const SPEED = 5;
	const ADDITIONAL_SPEED = 0.1;
	const BLOCK_PACK_SIZE = 3;
	const PHASE_MAX = 2;
	const BALL_MAX = 1;
	const ASSET = {
		"image":{
			"bg": "image/bg_natural_ocean.jpg",
			"hiya0": "image/0.png",
			"hiya1": "image/1.png",
			"hiya2": "image/2.png",
			"wear1": "image/0-1.png",
			"wear2": "image/1-2.png",
		},
		"sound":{
			"bgm": "sound/Sparkling Sea.mp3",
			"biri": "sound/biri02.wav",
			"fall": "sound/mizu01_e.wav",
			"hit": "sound/shoot04.wav",
			"push": "sound/power21.wav",
		}
	};
	function getImageData(name)
	{
		var pixelData = new Array();
		var texture = phina.asset.AssetManager.get("image", name);
		var w = texture.domElement.width;
		var h = texture.domElement.height;

		var src = phina.graphics.Canvas().setSize(w, h);
		src.context.drawImage(texture.domElement, 0, 0);

		var srcData = src.context.getImageData(0, 0, w, h).data;
		
		var isAlpha = srcData.length / w / h === 4;
		var dataLength = isAlpha?4:3
		for(var i = 0; i < srcData.length; i += dataLength)
		{
			var rgba = 0;
			for(var j = 0; j < dataLength; j++)
			{
				rgba |= srcData[i+j] << (8 * j);
			}
			pixelData.push({
				r: rgba & 0xff,
				g: rgba >>> 8 & 0xff,
				b: rgba >>> 16 & 0xff,
				a: rgba >>> 24 & 0xff,
			});
		}
		return ({
			data: pixelData,
			width: w,
			height: h,
		});
	}
	// ニアレストネイバー
	function createScaledImage(imageData, name, scale)
	{
		var newImage = phina.graphics.Canvas().setSize(imageData.width * scale, imageData.height * scale);
		for(var y=0; y<imageData.height; y++)
		{
			for(var x=0;x<imageData.width; x++)
			{
				newImage.strokeStyle = newImage.fillStyle = "rgba({r},{g},{b},{a})".format(imageData.data[x + y * imageData.width]);
				newImage.fillRect(x * scale, y * scale, scale, scale);
				newImage.strokeRect(x * scale, y * scale, scale, scale);
			}
		}
		phina.asset.AssetManager.set("image", name, newImage);
	}
	phina.globalize();

	phina.define("Ball",
	{
		superClass: "CircleShape",
		init: function(param)
		{
			this.superInit(param);
			this.fill = "white";
			this.stroke = "transparent";
			this.speed = SPEED;
		},
		reset: function()
		{
			this.physical.velocity = Vector2(0,0);
		},
		vectorAngle: function(deg)
		{
			this.physical.velocity.fromDegree(deg, this.speed);
		},
	});
	
	phina.define("Paddle",
	{
		superClass: "RectangleShape",
		init: function(param)
		{
			this.superInit(param);
			this.hold = true;
		},
	});
	
	phina.define("Block",
	{
		superClass: "RectangleShape",
		init: function(ix,iy)
		{
			this.superInit();
			this.ix = ix;
			this.iy = iy;
			this.stroke = "transparent";
		},
		update: function(app)
		{
			var bpm = 125.02;
			var bps = bpm / 60;
			var fps = 30;
			var mul = 4;
			var mod = (fps / bps * mul);
			
			this.stroke = "rgba(255,255,255,{0}".format(
			Math.abs((app.frame % mod) - mod / 2) / mod / 2);
		}
	});
	
	phina.define('MainScene',
	{
		superClass: 'DisplayScene',
		init: function()
		{
			this.superInit();
			
			var bg = Sprite("bg")
				.setOrigin(0, 0)
				.setSize(this.gridY.width*2, this.gridY.width)
				.setPosition(-this.gridY.width/4, 0)
				.addChildTo(this);
				
			this.phase = 1;
			
			this.blockArray = new Array();
			for(var y=0;y<FIELD.height;y++)
			{
				this.blockArray[y] = new Array();
				for(var x=0;x<FIELD.width;x++)
				{
					this.blockArray[y][x] = null;
				}
			}
			
			this.background = Sprite("hiya0").addChildTo(this);
			this.background.setPosition(
				FIELD.x + FIELD.scale * FIELD.width / 2 - FIELD.scale,
				FIELD.y + FIELD.scale * FIELD.height / 2 - FIELD.scale
			);
			
			this.blocks = DisplayElement().addChildTo(this);
			
			this.initBlocks();
			
			this.paddle = Paddle({
				width: this.gridX.span(3),
				height: this.gridY.span(1) / 4,
				y: this.gridY.span(15),
			}).addChildTo(this);
			
			this.ball = Ball({
				radius: this.gridX.width / 64,
			}).addChildTo(this);
			
			this.combo = 0;
			
			this.scoreLabel = Label(0)
				.setPosition(this.gridX.span(8), this.gridY.span(1))
				.addChildTo(this);
			this.scoreLabel.fill = "white";
			this.score = 0;
			
			this.ballLeftLabel = Label(0)
				.setOrigin(1,0.5)
				.setPosition(this.gridX.span(15),this.gridY.span(1))
				.addChildTo(this);
			this.ballLeftLabel.fill = "white";
			
			this.ballLeft = BALL_MAX;
		},
		testBallBlock: function(app)
		{
			var x = parseInt((this.ball.x - FIELD.x) / FIELD.scale);
			var y = parseInt((this.ball.y - FIELD.y) / FIELD.scale);
			
			for(var ix = -BLOCK_PACK_SIZE; ix < BLOCK_PACK_SIZE; ix++)
			{
				for(var iy = -BLOCK_PACK_SIZE; iy < BLOCK_PACK_SIZE; iy++)
				{
					if(y + iy < 0 || y + iy >= FIELD.height
					|| x + ix < 0 || x + ix >= FIELD.width)
					{
						continue;
					}
					var block = this.blockArray[y + iy][x + ix];
					if(block == null)
					{
						continue;
					}
					if(Collision.testCircleRect(this.ball,block))
					{
						SoundManager.play("biri");
						var dq = Vector2.sub(this.ball, block);

						if(Math.abs(dq.x) <= Math.abs(dq.y))
						{
							this.ball.physical.velocity.y *= -1;
						}
						if(Math.abs(dq.x) >= Math.abs(dq.y))
						{
							this.ball.physical.velocity.x *= -1;
						}
						
						
						// ボールがヒットしたブロックが属するパックの先頭XYを求める
						var firstX = block.ix - block.ix % BLOCK_PACK_SIZE;
						var firstY = block.iy - block.iy % BLOCK_PACK_SIZE;
						
						{
							for(var i=0;i<BLOCK_PACK_SIZE;i++)
							{
								for(var j=0;j<BLOCK_PACK_SIZE;j++)
								{
									if(this.blockArray[firstY + j][firstX + i] !== null)
									{
										var b = this.blockArray[firstY + j][firstX + i];
										var toX = Random.randint(-5,5);
										var toY = Random.randint(-5,-10);
										b.physical.gravity.y = 1;
										b.physical.force(toX,toY);
										this.blockArray[firstY + j][firstX + i] = null;
										this.brokenBlock++;
									}
								}
							}
						}
						
						this.ball.speed += ADDITIONAL_SPEED;
						this.ball.vectorAngle(this.ball.physical.velocity.toDegree());
						
						this.combo++;
						this.score += this.combo * 100;
						if(this.combo > 1)
						{
							var comboLabel = Label(this.combo + "コンボ！")
								.setPosition(this.ball.x, this.ball.y + this.ball.radius * (6 - this.combo % 10 * 2))
								.addChildTo(this);
							comboLabel.fill = "white";
							comboLabel.tweener.by({
								y: -this.ball.radius * 6,
								alpha: -1,
							}, 500)
							.call(function()
							{
								comboLabel.remove();
							});
						}
					}
				}
			};
		},
		initBlocks: function()
		{
			this.background.setImage("hiya"+this.phase);
			
			var blockPixel = getImageData("wear"+this.phase);
			
			var cnt = 0;
			for(var i = 0; i < blockPixel.data.length; i++)
			{
				if(blockPixel.data[i].a != 255)continue;
				var ix = i % blockPixel.width - 1;
				var iy = parseInt(i / blockPixel.width) - 1;
				var block = Block(ix,iy);
				block.setSize(FIELD.scale, FIELD.scale);
				block.fill = "rgb({r},{g},{b})".format(blockPixel.data[i]);
					
				block.setPosition(
					FIELD.x + ix * FIELD.scale + FIELD.scale / 2,
					FIELD.y + iy * FIELD.scale + FIELD.scale / 2);
				block.addChildTo(this.blocks);
				this.blockArray[iy][ix] = block;
				cnt++;
			}
			this.maxBlock = cnt;
			this.brokenBlock = 0;
		},
		update: function(app)
		{
			this.paddle.x = app.pointer.x;	// パドルをカーソルXに追従
			// フェーズクリア判定
			if(this.blocks.children.length == 0)
			{
				++this.phase;
				
				// クリア判定
				if(this.phase > PHASE_MAX)
				{
					this.exit({
						phase: PHASE_MAX,
						blocks: null,
						score: this.score,
						leftBlockRate: 0,
					});
				}
				else
				{
					// ブロック初期化
					this.initBlocks();
					
					// ボールをホールドする
					this.ball.reset();
					this.paddle.hold = true;
					this.combo = 0;
				}
				return;
			}
			
			// ボールホールド処理
			if(this.paddle.hold)
			{
				this.ball.setPosition(this.paddle.x, this.paddle.top - this.ball.radius - 2);
				return;
			}
			
			// ブロック判定
			this.testBallBlock(app);
			
			// パドル判定
			if(Collision.testCircleRect(this.ball,this.paddle))
			{
				SoundManager.play("hit");
				this.ball.bottom = this.paddle.top;
				
				var dx = this.paddle.x - this.ball.x;
				var deg = Math.radToDeg(Math.atan2(dx,-this.paddle.width / 2)) + 90;
				this.ball.speed += ADDITIONAL_SPEED * 2;
				this.ball.vectorAngle(deg);
				this.combo = 0;
			}
			
			// 壁判定
			if(this.ball.left <= 0)
			{
				SoundManager.play("hit");
				this.ball.physical.velocity.x *= -1;
				this.ball.left = 1;
			}
			if(this.ball.right > this.gridX.width)
			{
				SoundManager.play("hit");
				this.ball.physical.velocity.x *= -1;
				this.ball.right = this.gridX.width - 1;
			}
			if(this.ball.top <= 0)
			{
				SoundManager.play("hit");
				this.ball.physical.velocity.y *= -1;
				this.ball.top = 1;
			}
			
			// 脱落判定
			if(this.ball.bottom > this.gridY.width)
			{
				SoundManager.play("fall");
				this.ball.reset();
				this.paddle.hold = true;
				this.combo = 0;
				this.ballLeft--;
				if(this.ballLeft < 0)
				{
					this.exit({
						phase: this.phase,
						blocks: this.blockArray,
						score: this.score,
						leftBlockRate: this.brokenBlock / this.maxBlock,
					});
				}
			}
			
			// いらないもの削除
			this.blocks.children.each(function(block)
			{
				if(block.top > this.gridY.width)
				{
					block.remove();
				}
			}.bind(this));
		},
		onpointstart: function()
		{
			// ボール発射処理
			if(this.paddle.hold)
			{
				SoundManager.play("hit");
				this.paddle.hold = false;
				this.ball.vectorAngle(-45);
			}
		},
		_accessor:{
			score:{
				get: function()
				{
					return this._score;
				},
				set: function(a)
				{
					this._score = a;
					this.scoreLabel.text = this._score;
				}
			},
			ballLeft:{
				get: function()
				{
					return this._ballLeft;
				},
				set: function(a)
				{
					this._ballLeft = a;
					this.ballLeftLabel.text = "●:"+this._ballLeft;
				}
			}
		}
	});
	phina.define("TitleScene",
	{
		superClass: "DisplayScene",
		init: function()
		{
			this.superInit();
			
			var bg = Sprite("bg")
				.setOrigin(0, 0)
				.setSize(this.gridY.width*2, this.gridY.width)
				.setPosition(-this.gridY.width/4, 0)
				.addChildTo(this);
				
			this.background = Sprite("hiya0").addChildTo(this);
			this.background.setPosition(
				FIELD.x + FIELD.scale * FIELD.width / 2 - FIELD.scale,
				FIELD.y + FIELD.scale * FIELD.height / 2 - FIELD.scale
			);
			
			var label = Label("ヒヤ.崩し")
				.setPosition(this.gridX.center(), this.gridY.center(-2))
				.addChildTo(this);
			label.fill = "black";
			label.fontSize = 60;
			
			label = Label("ヒヤ.崩し")
				.setPosition(this.gridX.center()+1, this.gridY.center(-2)+1)
				.addChildTo(this);
			label.fill = "white";
			label.fontSize = 60;
			
			var label = Label("クリックでスタート")
				.setPosition(this.gridX.center(), this.gridY.center())
				.addChildTo(this);
			label.fill = "white";
			
			label = Label("ヒヤ.\nザ・マッチメイカァズ\nDOVA-SYNDROME\nいらすとや\nYukiYukiVirtual")
				.setOrigin(0.5,1)
				.setPosition(this.gridX.center(),this.gridY.span(16))
				.addChildTo(this);
			label.fontSize = 30;
		},
		onclick: function()
		{
			SoundManager.play("push");
			this.exit();
		}
	});
	phina.define("ResultScene",
	{
		superClass: "DisplayScene",
		init: function(param)
		{
			this.superInit();
			
			var bg = Sprite("bg")
				.setOrigin(0, 0)
				.setSize(this.gridY.width*2, this.gridY.width)
				.setPosition(-this.gridY.width/4, 0)
				.addChildTo(this);
				
			var background = Sprite("hiya"+param.phase).addChildTo(this);
			background.setPosition(
				FIELD.x + FIELD.scale * FIELD.width / 2 - FIELD.scale,
				FIELD.y + FIELD.scale * FIELD.height / 2 - FIELD.scale
			);
			if(param.blocks != null)
			{
				for(var x=0;x<FIELD.width;x++)
				{
					for(var y=0;y<FIELD.height;y++)
					{
						if(param.blocks[y][x] == null)continue;
						param.blocks[y][x].addChildTo(this);
						param.blocks[y][x].update = null;
						param.blocks[y][x].stroke = "transparent";
					}
				}
			}
			
			var scoreLabel = Label(param.score+"点")
				.setPosition(this.gridX.span(8), this.gridY.span(1))
				.addChildTo(this);
			scoreLabel.fontSize = 64;
			scoreLabel.fill = "white";
			
			var shareButton = Button({
				text: "ツイート",
				width: 200,
				height: 100,
				fontSize: 40,
				cornerRadius: 50,
			})
				.setPosition(this.gridX.center(-3), this.gridY.span(13))
				.addChildTo(this);
				
			var ptext = param.phase == 1?
				(param.leftBlockRate < 0.5?
					"ヒヤ.ちゃんを全然脱がせませんでした。"
					:"ヒヤ.ちゃんをちょっと脱がしました。")
				:(param.blocks != null?
					(param.leftBlockRate < 0.5?
						"ヒヤ.ちゃんの上着を脱がせました。"
						:"ヒヤ.ちゃんをほとんど水着にできました。")
					:"ヒヤ.ちゃんを水着にできました。ヒヤァ～");
			shareButton.onclick = function()
			{
				var text = '{0}{1}点'.format(ptext, param.score);
				var url = phina.social.Twitter.createURL({
					text: text,
					hashtags: ["ヒヤ崩し","YukiYukiVirtual"],
					url: location.href,
				});
				window.open(url, 'share window');
			}
			var replayButton = Button({
				text: "リプレイ",
				width: 200,
				height: 100,
				fontSize: 40,
				cornerRadius: 50,
			})
				.setPosition(this.gridX.center(3), this.gridY.span(13))
				.addChildTo(this);
				
            replayButton.onclick = function() {
              this.exit();
            }.bind(this);
		},
	});
	phina.define("SplashScene",
	{
		superClass: "DisplayScene",
		init: function()
		{
			this.superInit();
			this.backgroundColor = "black";
			
			var label = Label("PC・Chrome強く推奨\n音が出ます\nOK")
				.setPosition(this.gridX.center(), this.gridY.center())
				.addChildTo(this);
			label.fill = "white";
		},
		onclick: function()
		{
			SoundManager.play("push");
			SoundManager.playMusic("bgm");
			this.exit();
		}
	});
	phina.define("LoadingScene",
	{
		superClass: "DisplayScene",
		init: function(options) {
			this.superInit(options);
			this.backgroundColor = "black";
			var loader = AssetLoader();
			
			var label = Label("読み込み中...")
				.setPosition(this.gridX.center(), this.gridY.center())
				.addChildTo(this);
			label.fill = "white";
			

			loader.onload = function() {
				{
					var blockPixel = getImageData("hiya0");
					var lx = this.gridX.span(14);
					var ly = this.gridY.span(12);
					var sx = lx/blockPixel.width;
					var sy = ly/blockPixel.height;
					var scale = Math.min(sx,sy);
					var offsetX = (this.gridX.width - blockPixel.width * scale) / 2;
					var offsetY = this.gridY.span(0.5);
					FIELD = {
						x: offsetX,
						y: offsetY,
						width: blockPixel.width,
						height: blockPixel.height,
						scale: scale,
					};
				}
				createScaledImage(getImageData("hiya0"), "hiya0", FIELD.scale);
				createScaledImage(getImageData("hiya1"), "hiya1", FIELD.scale);
				createScaledImage(getImageData("hiya2"), "hiya2", FIELD.scale);
				
				this.flare('loaded');
			}.bind(this);

			loader.load(options.assets);
		},
	});
	phina.main(function()
	{
		var app = GameApp({
			startLabel: 'splash',
			assets: ASSET,
		});
		SoundManager.setVolumeMusic(0.1);
		SoundManager.setVolume(0.3);
		app.run();
	});
})();