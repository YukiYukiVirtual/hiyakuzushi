(function(){
	const SPEED = 5;
	const ADDITIONAL_SPEED = 0.1;
	const BLOCK_PACK_SIZE = 3;
	const ASSET = {
		"image":{
			"bg": "image/bg_natural_ocean.jpg",
			"fore": "image/fore.png",
			"back": "image/back.png",
		},
		"sound":{
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
	phina.globalize();

	phina.define("Ball",
	{
		superClass: "CircleShape",
		init: function(param)
		{
			this.superInit(param);
			this.fill = "white";
			this.stroke = "transparent";
			this.isCritical = false;
			this.reset();
		},
		reset: function()
		{
			this.additionalSPEED = 0;
			this.physical.velocity = Vector2(0,0);
		},
		vectorAngle: function(deg)
		{
			this.physical.velocity.fromDegree(deg, SPEED + this.additionalSPEED);
		}
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
			this.color = this.fill;
			this.setOrigin(0,0);
			this.ix = ix;
			this.iy = iy;
		},
		_accessor:{
			color:{
				set:function(a)
				{
					this.fill = a;
					this.stroke = a; // debug
				}
			}
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
			
			this.skins = DisplayElement().addChildTo(this);
			this.blocks = DisplayElement().addChildTo(this);
			
			
			
			var blockPixel = getImageData("fore");
			var lx = this.gridX.span(14);
			var ly = this.gridY.span(12);
			var sx = lx/blockPixel.width;
			var sy = ly/blockPixel.height;
			var scale = Math.min(sx,sy);
			console.log(scale);
			
			this.fieldX = Grid({
				width: blockPixel.width * scale,
				columns: blockPixel.width,
				offset: (this.gridX.width - blockPixel.width * scale) / 2,
			});
			this.fieldY = Grid({
				width: blockPixel.height * scale,
				columns: blockPixel.height,
				offset: 0,
			});
			
			var drawPixels = function(imageData, dest)
			{
				for(var i = 0; i < imageData.data.length; i++)
				{
					if(imageData.data[i].a != 255)continue;
					var block = Block(i % imageData.width, parseInt(i / imageData.width)).addChildTo(dest);
					block.setSize(scale,scale);
					block.color = "rgba({r},{g},{b},{a})".format(imageData.data[i]);
					block.setPosition(
						this.fieldX.span(
							block.ix
						),
						this.fieldY.span(
							block.iy
						));
				}
			}.bind(this);
			drawPixels(getImageData("back"), this.skins);
			drawPixels(blockPixel, this.blocks);
			
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
			
			this.timeLabel = Label(0)
				.setOrigin(1,0.5)
				.setPosition(this.gridX.span(15),this.gridY.span(1))
				.addChildTo(this);
			this.timeLabel.fill = "white";
			this.time = 0;
			
			var cover = this.loadingCover = RectangleShape();
			cover.fill = "white";
			cover.stroke = "white";
			cover.setSize(this.gridX.width,this.gridY.width);
			cover.setPosition(this.gridX.span(8),this.gridY.span(8));
			cover.tweener.to({alpha:0},1000)
			cover.addChildTo(this);
		},
		update: function(app)
		{
			this.paddle.x = app.pointer.x;	// パドルをカーソルXに追従
			if(this.paddle.hold)
			{
				this.ball.setPosition(this.paddle.x, this.paddle.top - this.ball.radius - 2);
				return;
			}
			
			this.time++;
			
			// ブロック判定
			this.blocks.children.each(function(block)
			{
				if(Collision.testCircleRect(this.ball,block))
				{
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
					// ブロックを全探索
					this.blocks.children.clone().each(function(rblock)
					{
						// ブロック生成時(135行目定義)に設定した位置ix,iyと先頭XYを比較して削除する
						if(firstX <= rblock.ix && rblock.ix < firstX + BLOCK_PACK_SIZE
							&& firstY <= rblock.iy && rblock.iy < firstY + BLOCK_PACK_SIZE)
						{
							rblock.remove();
						}
					}.bind(this));
					
					console.log("remove");
					
					this.ball.additionalSPEED += ADDITIONAL_SPEED;
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
			}.bind(this));
			
			// パドル判定
			if(Collision.testCircleRect(this.ball,this.paddle))
			{
				this.ball.bottom = this.paddle.top;
				
				var dx = this.paddle.x - this.ball.x;
				var deg = Math.radToDeg(Math.atan2(dx,-this.paddle.width / 2)) + 90;
				this.ball.additionalSPEED += ADDITIONAL_SPEED * 2;
				this.ball.vectorAngle(deg);
				this.combo = 0;
			}
			
			// 壁判定
			if(this.ball.left <= 0)
			{
				this.ball.physical.velocity.x *= -1;
				this.ball.left = 1;
			}
			if(this.ball.right > this.gridX.width)
			{
				this.ball.physical.velocity.x *= -1;
				this.ball.right = this.gridX.width - 1;
			}
			if(this.ball.top <= 0)
			{
				this.ball.physical.velocity.y *= -1;
				this.ball.top = 1;
				this.ball.isCritical = false;
			}
			
			// 脱落判定
			if(this.ball.bottom > this.gridY.width)
			{
				this.ball.reset();
				this.paddle.hold = true;
				this.combo = 0;
			}
		},
		onpointstart: function()
		{
			if(this.paddle.hold)
			{
				this.paddle.hold = false;
				this.ball.physical.velocity.fromDegree(-45,SPEED);
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
			time:{
				get: function()
				{
					return this._time;
				},
				set: function(a)
				{
					this._time = a;
					this.timeLabel.text = this._time;
				}
			}
		}
	});

	phina.main(function()
	{
		var app = GameApp({
			startLabel: 'main',
			assets: ASSET,
		});
		app.run();
	});
})();