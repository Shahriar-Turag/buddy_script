const FRIENDS = [
  { img: "/assets/images/people1.png", name: "Steve Jobs", role: "CEO of Apple", inactive: true, side: "5 minute ago" as const },
  { img: "/assets/images/people2.png", name: "Ryan Roslansky", role: "CEO of Linkedin", inactive: false, side: "online" as const },
  { img: "/assets/images/people3.png", name: "Dylan Field", role: "CEO of Figma", inactive: false, side: "online" as const },
  { img: "/assets/images/people1.png", name: "Steve Jobs", role: "CEO of Apple", inactive: true, side: "5 minute ago" as const },
  { img: "/assets/images/people2.png", name: "Ryan Roslansky", role: "CEO of Linkedin", inactive: false, side: "online" as const },
  { img: "/assets/images/people3.png", name: "Dylan Field", role: "CEO of Figma", inactive: false, side: "online" as const },
];

function OnlineDot() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 14 14">
      <rect width="12" height="12" x="1" y="1" fill="#0ACF83" stroke="#fff" strokeWidth="2" rx="6" />
    </svg>
  );
}

export function FeedRightSidebar() {
  return (
    <div className="_layout_right_sidebar_wrap">
        <div className="_layout_right_sidebar_inner">
          <div className="_right_inner_area_info _padd_t24 _padd_b24 _padd_r24 _padd_l24 _b_radious6 _feed_inner_area">
            <div className="_right_inner_area_info_content _mar_b24">
              <h4 className="_right_inner_area_info_content_title _title5">You Might Like</h4>
              <span className="_right_inner_area_info_content_txt">
                <a className="_right_inner_area_info_content_txt_link" href="#0">
                  See All
                </a>
              </span>
            </div>
            <hr className="_underline" />
            <div className="_right_inner_area_info_ppl">
              <div className="_right_inner_area_info_box">
                <div className="_right_inner_area_info_box_image">
                  <a href="#0">
                    <img src="/assets/images/Avatar.png" alt="" className="_ppl_img" />
                  </a>
                </div>
                <div className="_right_inner_area_info_box_txt">
                  <a href="#0">
                    <h4 className="_right_inner_area_info_box_title">Radovan SkillArena</h4>
                  </a>
                  <p className="_right_inner_area_info_box_para">Founder & CEO at Trophy</p>
                </div>
              </div>
              <div className="_right_info_btn_grp">
                <button type="button" className="_right_info_btn_link">
                  Ignore
                </button>
                <button type="button" className="_right_info_btn_link _right_info_btn_link_active">
                  Follow
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="_layout_right_sidebar_inner">
          <div className="_feed_right_inner_area_card _padd_t24 _padd_b6 _padd_r24 _padd_l24 _b_radious6 _feed_inner_area">
            <div className="_feed_top_fixed">
              <div className="_feed_right_inner_area_card_content _mar_b24">
                <h4 className="_feed_right_inner_area_card_content_title _title5">Your Friends</h4>
                <span className="_feed_right_inner_area_card_content_txt">
                  <a className="_feed_right_inner_area_card_content_txt_link" href="#0">
                    See All
                  </a>
                </span>
              </div>
              <form className="_feed_right_inner_area_card_form" onSubmit={(e) => e.preventDefault()}>
                <svg className="_feed_right_inner_area_card_form_svg" xmlns="http://www.w3.org/2000/svg" width="17" height="17" fill="none" viewBox="0 0 17 17">
                  <circle cx="7" cy="7" r="6" stroke="#666" />
                  <path stroke="#666" strokeLinecap="round" d="M16 16l-3-3" />
                </svg>
                <input
                  className="form-control me-2 _feed_right_inner_area_card_form_inpt"
                  type="search"
                  placeholder="input search text"
                  aria-label="Search"
                />
              </form>
            </div>
            <div className="_feed_bottom_fixed">
              {FRIENDS.map((f, i) => (
                <div
                  key={`${f.name}-${i}`}
                  className={`_feed_right_inner_area_card_ppl${f.inactive ? " _feed_right_inner_area_card_ppl_inactive" : ""}`}
                >
                  <div className="_feed_right_inner_area_card_ppl_box">
                    <div className="_feed_right_inner_area_card_ppl_image">
                      <a href="#0">
                        <img src={f.img} alt="" className="_box_ppl_img" />
                      </a>
                    </div>
                    <div className="_feed_right_inner_area_card_ppl_txt">
                      <a href="#0">
                        <h4 className="_feed_right_inner_area_card_ppl_title">{f.name}</h4>
                      </a>
                      <p className="_feed_right_inner_area_card_ppl_para">{f.role}</p>
                    </div>
                  </div>
                  <div className="_feed_right_inner_area_card_ppl_side">
                    {f.side === "online" ? <OnlineDot /> : <span>{f.side}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
  );
}
